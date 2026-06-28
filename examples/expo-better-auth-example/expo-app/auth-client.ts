import { expoClient } from "@better-auth/expo/client";
import { wechatClient } from "@chinafast/expo-wechat-auth/better-auth/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const API_URL = "http://localhost:4001";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "wechatbetterauth",
      storage: SecureStore,
    }),
    wechatClient(),
  ],
});
