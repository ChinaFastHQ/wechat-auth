import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createWeChatAuth } from "@chinafast/web-wechat-auth";
import {
  WeChatAuthProvider,
  useWeChatAuth,
  useWeChatRedirectCallback,
} from "@chinafast/web-wechat-auth/react";
// oxlint-disable-next-line import/no-unassigned-import -- Vite applies global CSS via import.
import "./style.css";

const client = createWeChatAuth({
  web: {
    appId: import.meta.env.VITE_WECHAT_WEB_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || window.location.origin + "/",
  },
  officialAccount: {
    appId: import.meta.env.VITE_WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || window.location.origin + "/",
  },
  stateUrl: "http://localhost:4101/auth/wechat/state",
  exchangeUrl: "http://localhost:4101/auth/wechat",
});

function SignIn() {
  const { signIn, loading, error, environment } = useWeChatAuth();
  const callback = useWeChatRedirectCallback();
  return (
    <main>
      <h1>React + WeChat</h1>
      <p>
        Detected: {environment.device} / {environment.browser}
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WeChatAuthProvider client={client}>
      <SignIn />
    </WeChatAuthProvider>
  </StrictMode>
);
