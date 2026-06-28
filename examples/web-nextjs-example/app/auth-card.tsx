"use client";
import { useMemo } from "react";
import { createWeChatAuth } from "@chinafast/web-wechat-auth";
import {
  WeChatAuthProvider,
  useWeChatAuth,
  useWeChatRedirectCallback,
} from "@chinafast/web-wechat-auth/react";

function Content() {
  const { signIn, loading, error, environment } = useWeChatAuth();
  const callback = useWeChatRedirectCallback();
  return (
    <main>
      <h1>Next.js + WeChat</h1>
      <p>
        SSR-safe setup using a client component for browser interaction. Detected:{" "}
        {environment.browser}.
      </p>
      <p>The included Express server validates state and exchanges the code.</p>
      <button disabled={loading} onClick={() => void signIn()}>
        {loading ? "Opening WeChat…" : "Continue with WeChat"}
      </button>
      {error && <p className="error">{error.message}</p>}
      {callback && <pre>{JSON.stringify(callback, null, 2)}</pre>}
    </main>
  );
}

export function AuthCard() {
  const client = useMemo(
    () =>
      createWeChatAuth({
        web: {
          appId: process.env.NEXT_PUBLIC_WECHAT_WEB_APP_ID || "",
          redirectUri: process.env.NEXT_PUBLIC_WECHAT_REDIRECT_URI || "http://localhost:3000/",
        },
        officialAccount: {
          appId: process.env.NEXT_PUBLIC_WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
          redirectUri: process.env.NEXT_PUBLIC_WECHAT_REDIRECT_URI || "http://localhost:3000/",
        },
        stateUrl: "http://localhost:4100/auth/wechat/state",
        exchangeUrl: "http://localhost:4100/auth/wechat",
      }),
    []
  );
  return (
    <WeChatAuthProvider client={client}>
      <Content />
    </WeChatAuthProvider>
  );
}
