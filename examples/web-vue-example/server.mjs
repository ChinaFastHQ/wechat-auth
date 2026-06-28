import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import {
  createMemoryStateStore,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
} from "@chinafast/wechat-auth-server";

dotenv.config();

const app = express();
const port = Number(process.env.SERVER_PORT || 4102);
const stateStore = createMemoryStateStore();
const credentials = {
  web: {
    appId: process.env.WECHAT_WEB_APP_ID || "",
    secret: process.env.WECHAT_WEB_APP_SECRET || "",
  },
  officialAccount: {
    appId: process.env.WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
    secret: process.env.WECHAT_OFFICIAL_ACCOUNT_APP_SECRET || "",
  },
};

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/auth/wechat/state", (_request, response) => {
  response.json(stateStore.create());
});

async function handleExchange(request, response) {
  const { code, state, flow } = request.body || {};
  if (typeof code !== "string" || typeof state !== "string" || typeof flow !== "string") {
    response.status(400).json({ error: "code, state, and flow are required" });
    return;
  }
  const consumed = stateStore.consume(state);
  if (!consumed.ok) {
    response.status(400).json({ error: `state is ${consumed.reason}` });
    return;
  }
  try {
    const token = await exchangeWeChatCode({ code, flow }, { credentials });
    const user = await fetchWeChatUserInfo(token);
    response.json({ user });
  } catch (error) {
    response
      .status(502)
      .json({ error: error instanceof Error ? error.message : "WeChat exchange failed" });
  }
}

app.post("/auth/wechat", (request, response, next) => {
  void handleExchange(request, response).catch(next);
});

app.listen(port, () => console.log(`WeChat auth server listening on http://localhost:${port}`));
