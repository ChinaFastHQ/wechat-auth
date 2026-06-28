import { wechatPlugin } from "@chinafast/wechat-auth-server/better-auth";
import {
  createMemoryStateStore,
  type WeChatServerCredentials,
} from "@chinafast/wechat-auth-server";
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT || 4001);
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET is required. Copy .env.example to .env and configure it.");
}
// WeChat app secrets must never be included in the Expo bundle.
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

export const auth = betterAuth({
  database: new Database(process.env.DATABASE_PATH || "better-auth.sqlite"),
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
  secret: betterAuthSecret,
  trustedOrigins: [process.env.EXPO_APP_URL || "http://localhost:8081", "wechatbetterauth://"],
  plugins: [
    // Process-local state is suitable for this example. Use a shared store in production.
    wechatPlugin({ credentials, stateStore: createMemoryStateStore() }),
  ],
});
