<script lang="ts">
  import { onMount } from "svelte";
  import { createWeChatAuth, type WeChatAuthorizeResult, type WeChatSignInResult } from "@chinafast/web-wechat-auth";

  const redirectUri = import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/";
  const client = createWeChatAuth({
    web: { appId: import.meta.env.VITE_WECHAT_WEB_APP_ID || "", redirectUri },
    officialAccount: {
      appId: import.meta.env.VITE_WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
      redirectUri,
    },
    stateUrl: "http://localhost:4103/auth/wechat/state",
    exchangeUrl: "http://localhost:4103/auth/wechat",
  });
  let loading = false;
  let result: WeChatAuthorizeResult | WeChatSignInResult | null = null;

  async function signIn() {
    loading = true;
    result = await client.signIn();
    loading = false;
  }

  onMount(async () => {
    if (new URL(location.href).searchParams.has("code")) {
      result = await client.handleRedirectCallback(location.href);
    }
  });
</script>

<main>
  <h1>Svelte + WeChat</h1>
  <p>Svelte lifecycle integration with the browser client.</p>
  <p>The included Express server validates state and exchanges the code.</p>
  <button disabled={loading} on:click={signIn}>
    {loading ? "Opening WeChat…" : "Continue with WeChat"}
  </button>
  {#if result}<pre>{JSON.stringify(result, null, 2)}</pre>{/if}
</main>
