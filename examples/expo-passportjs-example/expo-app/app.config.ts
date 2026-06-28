import type { ExpoConfig } from "expo/config";

const appId = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
if (!appId) {
  throw new Error("EXPO_PUBLIC_WECHAT_OPEN_APP_ID is required. Copy .env.example to .env.");
}

const config: ExpoConfig = {
  name: "WeChat Passport.js example",
  slug: "wechat-passportjs-example",
  scheme: "wechatpassport",
  plugins: [
    [
      "@chinafast/expo-wechat-auth/plugin",
      {
        wechat: {
          appId,
          universalLink: "https://example.com/app/",
        },
        scheme: "wechatpassport",
      },
    ],
  ],
  web: { bundler: "metro" },
};

export default config;
