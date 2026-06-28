import { createWeChatAuth } from "@chinafast/web-wechat-auth";
// oxlint-disable-next-line import/no-unassigned-import -- Vite applies global CSS via import.
import "./style.css";
const client = createWeChatAuth({
  web: {
    appId: import.meta.env.VITE_WECHAT_WEB_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/",
  },
  officialAccount: {
    appId: import.meta.env.VITE_WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/",
  },
  stateUrl: "http://localhost:4104/auth/wechat/state",
  exchangeUrl: "http://localhost:4104/auth/wechat",
});
const button = document.querySelector("#sign-in");
const output = document.querySelector("#result");

function show(value) {
  output.hidden = false;
  output.textContent = JSON.stringify(value, null, 2);
}
button.addEventListener("click", async () => {
  button.disabled = true;
  show(await client.signIn());
  button.disabled = false;
});
if (["code", "error", "errcode"].some((key) => new URL(location.href).searchParams.has(key))) {
  void client.handleRedirectCallback(location.href).then(show);
}
