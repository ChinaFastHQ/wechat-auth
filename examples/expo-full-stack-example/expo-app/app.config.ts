import type { ExpoConfig } from "expo/config";

const appId = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
if (!appId) {
  throw new Error("EXPO_PUBLIC_WECHAT_OPEN_APP_ID is required. Copy .env.example to .env.");
}

const config: ExpoConfig = {
  name: "WeChat Full-stack example",
  slug: "wechat-full-stack-example",
  scheme: "wechatfullstack",
  plugins: [
    "expo-secure-store",
    [
      "@chinafast/expo-wechat-auth/plugin",
      {
        wechat: {
          appId,
          universalLink: "https://example.com/app/",
        },
        scheme: "wechatfullstack",
      },
    ],
  ],
  web: { bundler: "metro" },
};

export default config;
