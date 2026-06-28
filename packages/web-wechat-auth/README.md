# @chinafast/web-wechat-auth

```ts
import { createWeChatAuth } from "@chinafast/web-wechat-auth";

const config = await fetch("/auth/wechat/config").then((response) => response.json());
const wechat = createWeChatAuth({
  web: { appId: config.webAppId, redirectUri: config.redirectUri },
  officialAccount: { appId: config.officialAccountAppId, redirectUri: config.redirectUri },
});
await wechat.signIn();
```

React is an optional entry point:

```tsx
import { WeChatAuthProvider, useWeChatAuth } from "@chinafast/web-wechat-auth/react";

function Button() {
  const { signIn, loading } = useWeChatAuth();
  return (
    <button disabled={loading} onClick={() => void signIn()}>
      Sign in with WeChat
    </button>
  );
}

<WeChatAuthProvider client={wechat}>
  <Button />
</WeChatAuthProvider>;
```

Browser pending auth uses `sessionStorage` by default. Pass `{ storage: "local" }` for explicit `localStorage`, or inject a `PendingAuthStorage` implementation. Importing the root entry during SSR does not read browser globals.

The browser's pending state only correlates the callback. The server must atomically consume its own state before exchanging the authorization code.

Backend helpers and the Better Auth server plugin are provided by `@chinafast/wechat-auth-server`. The Better Auth client is available at `@chinafast/web-wechat-auth/better-auth/client` and accepts any core-compatible auth client.
