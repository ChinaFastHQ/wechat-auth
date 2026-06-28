import {
  createMemoryStateStore,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  type WeChatServerCredentials,
  type WeChatTokenResponse,
} from "@chinafast/wechat-auth-server";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

dotenv.config();

type AuthBody = {
  code?: string;
  state?: string;
  flow?: "native_app" | "desktop_qr" | "wechat_browser_oauth";
  redirectUri?: string;
};

const app = express();
const port = Number(process.env.PORT || 4000);
const expoAppUrl = process.env.EXPO_APP_URL || "http://localhost:8081";
const sessionSecret = requireEnvironmentVariable("SESSION_SECRET");

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and configure it.`);
  }
  return value;
}

// App secrets stay on the server. The SDK selects the credential pair that matches `flow`.
const wechatCredentials: WeChatServerCredentials = {
  openPlatform: {
    appId: process.env.WECHAT_OPEN_APP_ID || "",
    secret: process.env.WECHAT_OPEN_APP_SECRET || "",
  },
  web: {
    appId: process.env.WECHAT_WEB_APP_ID || "",
    secret: process.env.WECHAT_WEB_APP_SECRET || "",
  },
  officialAccount: {
    appId: process.env.WECHAT_MP_APP_ID || "",
    secret: process.env.WECHAT_MP_APP_SECRET || "",
  },
};
const users = new Map<
  string,
  {
    id: string;
    name: string;
    avatar?: string | null;
    provider: string;
    openid: string;
    unionid?: string;
  }
>();
// This store makes OAuth state single-use and rejects expired values. Use shared durable storage
// when multiple server processes need to consume state created by any other process.
const stateStore = createMemoryStateStore();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

async function exchangeCode(body: AuthBody): Promise<WeChatTokenResponse> {
  return exchangeWeChatCode(
    { code: body.code || "", flow: body.flow },
    { credentials: wechatCredentials }
  );
}

async function fetchUserInfo(token: WeChatTokenResponse) {
  return fetchWeChatUserInfo(token);
}

function createSession(user: { id: string; name: string }) {
  return jwt.sign({ sub: user.id, name: user.name }, sessionSecret, { expiresIn: "1h" });
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/auth/wechat/state", (_req, res) => {
  const { state, expiresAt } = stateStore.create();
  res.json({ state, expiresAt });
});

const wechatExchangeHandler = asyncHandler(async (req, res) => {
  try {
    const body = req.body as AuthBody;
    if (!body.code || !body.state || !body.redirectUri) {
      res.status(400).json({ error: "code, state, and redirectUri are required." });
      return;
    }
    const stateResult = stateStore.consume(body.state);
    if (!stateResult.ok) {
      res
        .status(400)
        .json({ error: stateResult.reason === "expired" ? "state expired." : "invalid state." });
      return;
    }
    // Exchange the short-lived authorization code only after consuming its matching state.
    const profile = await fetchUserInfo(await exchangeCode(body));
    const externalId = profile.unionid || profile.openid;
    const user = users.get(externalId) || {
      id: `user_${users.size + 1}`,
      name: profile.nickname || "WeChat User",
      avatar: profile.headimgurl,
      provider: "wechat",
      openid: profile.openid,
      unionid: profile.unionid,
    };
    users.set(externalId, user);
    const session = createSession(user);
    res.cookie("demo_session", session, { httpOnly: true, sameSite: "lax" });
    res.json({ user, session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown auth error" });
  }
});

app.post("/auth/wechat", wechatExchangeHandler);
app.post("/api/auth/sign-in/wechat", wechatExchangeHandler);

app.post("/auth/signout", (_req, res) => {
  res.clearCookie("demo_session");
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  const token = req.cookies.demo_session || req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ user: null });
    return;
  }
  try {
    res.json({ user: jwt.verify(token, sessionSecret) });
  } catch {
    res.status(401).json({ user: null });
  }
});

app.get("/auth/wechat/callback", (req, res) => {
  // Optional server relay for deployments that cannot register the Expo app URL directly.
  const redirectUrl = new URL(expoAppUrl);
  for (const key of ["code", "state", "error", "errcode"] as const) {
    const value = req.query[key];
    if (typeof value === "string") {
      redirectUrl.searchParams.set(key, value);
    }
  }
  res.redirect(302, redirectUrl.toString());
});

app.listen(port, () => {
  console.log(`Express WeChat auth example listening on http://localhost:${port}`);
});
