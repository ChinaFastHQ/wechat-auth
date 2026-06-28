import type { WeChatServerCredentials } from "@chinafast/wechat-auth-server";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import expressSession from "express-session";
import passport from "passport";

import { type DemoUser, WeChatStrategy } from "./wechat-strategy.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4002);
const expoAppUrl = process.env.EXPO_APP_URL || "http://localhost:8081";
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required. Copy .env.example to .env and configure it.");
}
const users = new Map<string, DemoUser>();
const usersById = new Map<string, DemoUser>();
// Credentials are server-only and selected according to the authorization flow sent by the app.
const credentials: WeChatServerCredentials = {
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
const wechatStrategy = new WeChatStrategy({
  credentials,
  users,
});

passport.use(wechatStrategy);
passport.serializeUser((user, done) => {
  // Store only the internal ID in the session cookie; deserialize it on later requests.
  const demoUser = user as DemoUser;
  usersById.set(demoUser.id, demoUser);
  done(null, demoUser.id);
});
passport.deserializeUser((id: string, done) => done(null, usersById.get(id) || false));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  expressSession({
    name: "passport.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/wechat/state", (_req, res) => res.json(wechatStrategy.stateStore.create()));

app.post("/auth/wechat", passport.authenticate("wechat"), (req, res) => {
  res.json({ user: req.user, session: req.sessionID });
});

app.get("/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ user: null });
    return;
  }
  res.json({ user: req.user, session: req.sessionID });
});

app.post("/auth/signout", (req, res, next) => {
  req.logout((error) => {
    if (error) {
      return next(error);
    }
    req.session.destroy((destroyError) => {
      if (destroyError) {
        return next(destroyError);
      }
      res.clearCookie("passport.sid");
      res.json({ ok: true });
    });
  });
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
  console.log(`Passport.js example listening on http://localhost:${port}`);
});
