import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createWeChatAuth } from "@chinafast/web-wechat-auth";
import {
  WeChatAuthProvider,
  useWeChatAuth,
  useWeChatRedirectCallback,
} from "@chinafast/web-wechat-auth/react";
// oxlint-disable-next-line import/no-unassigned-import -- Vite applies global CSS via import.
import "./style.css";

type Session = {
  user: { openid: string; unionid?: string; nickname?: string; headimgurl?: string };
};
const api = import.meta.env.VITE_API_URL || "http://localhost:5000";
const client = createWeChatAuth({
  web: {
    appId: import.meta.env.VITE_WECHAT_WEB_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/",
  },
  officialAccount: {
    appId: import.meta.env.VITE_WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/",
  },
  stateUrl: `${api}/api/auth/wechat/state`,
  exchangeUrl: `${api}/api/auth/wechat`,
});

function App() {
  const { signIn, loading, error } = useWeChatAuth();
  const callback = useWeChatRedirectCallback();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    void fetch(`${api}/api/session`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSession);
  }, [callback]);
  return (
    <main>
      <h1>React + Python + WeChat</h1>
      <p>
        The browser package handles flow selection and callback correlation. Flask owns credentials,
        one-time state, code exchange, and the session.
      </p>
      {session ? (
        <>
          <p>
            Signed in as <strong>{session.user.nickname || session.user.openid}</strong>.
          </p>
          {session.user.headimgurl && (
            <img width="72" height="72" alt="WeChat avatar" src={session.user.headimgurl} />
          )}
        </>
      ) : (
        <button disabled={loading} onClick={() => void signIn<Session>()}>
          {loading ? "Opening WeChat…" : "Continue with WeChat"}
        </button>
      )}
      {error && <p className="error">{error.message}</p>}
      {callback?.status === "failed" && <p className="error">{callback.error.message}</p>}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WeChatAuthProvider client={client}>
      <App />
    </WeChatAuthProvider>
  </StrictMode>
);
