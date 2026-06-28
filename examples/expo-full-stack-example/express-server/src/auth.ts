import type { WeChatServerCredentials } from "@chinafast/wechat-auth-server";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { database, redis } from "./infrastructure.js";
import { wechatPlugin } from "./wechat-plugin.js";

const port = Number(process.env.PORT || 4003);
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET is required. Copy .env.example to .env and configure it.");
}
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
  database,
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
  secret: betterAuthSecret,
  trustedOrigins: [process.env.EXPO_APP_URL || "http://localhost:8081", "wechatfullstack://"],
  plugins: [bearer(), wechatPlugin({ credentials, redis })],
});
