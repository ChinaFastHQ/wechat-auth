<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  createWeChatAuth,
  type WeChatAuthorizeResult,
  type WeChatSignInResult,
} from "@chinafast/web-wechat-auth";

const client = createWeChatAuth({
  web: {
    appId: import.meta.env.VITE_WECHAT_WEB_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/",
  },
  officialAccount: {
    appId: import.meta.env.VITE_WECHAT_OFFICIAL_ACCOUNT_APP_ID || "",
    redirectUri: import.meta.env.VITE_WECHAT_REDIRECT_URI || location.origin + "/",
  },
  stateUrl: "http://localhost:4102/auth/wechat/state",
  exchangeUrl: "http://localhost:4102/auth/wechat",
});
const loading = ref(false);
const result = ref<WeChatAuthorizeResult | WeChatSignInResult | null>(null);

async function signIn() {
  loading.value = true;
  result.value = await client.signIn();
  loading.value = false;
}

onMounted(async () => {
  if (new URL(location.href).searchParams.has("code")) {
    result.value = await client.handleRedirectCallback(location.href);
  }
});
</script>
<template>
  <main>
    <h1>Vue + WeChat</h1>
    <p>Composition API with the framework-neutral browser client.</p>
    <p>The included Express server validates state and exchanges the code.</p>
    <button :disabled="loading" @click="signIn">
      {{ loading ? "Opening WeChat…" : "Continue with WeChat" }}
    </button>
    <pre v-if="result">{{ JSON.stringify(result, null, 2) }}</pre>
  </main>
</template>
