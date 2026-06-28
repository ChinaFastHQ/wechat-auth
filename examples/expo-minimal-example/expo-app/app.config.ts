import type { ExpoConfig } from "expo/config";

const appId = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
if (!appId) {
  throw new Error("EXPO_PUBLIC_WECHAT_OPEN_APP_ID is required. Copy .env.example to .env.");
}

const config: ExpoConfig = {
  name: "expo-wechat-auth example",
  slug: "expo-wechat-auth-example",
  scheme: "wechatdemo",
  plugins: [
    [
      "@chinafast/expo-wechat-auth/plugin",
      {
        wechat: {
          appId,
          universalLink: "https://example.com/app/",
        },
        scheme: "wechatdemo",
      },
    ],
  ],
  android: { package: "com.chinafast.expowechatauthexample" },
  ios: { bundleIdentifier: "com.chinafast.expowechatauthexample" },
  web: { bundler: "metro" },
};

export default config;
