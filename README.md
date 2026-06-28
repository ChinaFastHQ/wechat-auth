# WeChat Auth monorepo

One portable authentication engine supports four independently published packages:

- `@chinafast/wechat-auth-core` contains framework-free policy, URL construction, state validation, and orchestration.
- `@chinafast/wechat-auth-server` contains server-only credential, code-exchange, profile, state-store, and Better Auth helpers.
- `@chinafast/expo-wechat-auth` supplies Expo/React Native environment, Linking, storage, and native SDK adapters while preserving the original API.
- `@chinafast/web-wechat-auth` supplies the canonical vanilla browser client plus `/react` and `/better-auth/client` entry points.

## Browser

```ts
import { createWeChatAuth } from "@chinafast/web-wechat-auth";

const config = await fetch("/auth/wechat/config").then((response) => response.json());
const wechat = createWeChatAuth({
  web: { appId: config.webAppId, redirectUri: config.redirectUri },
  officialAccount: { appId: config.officialAccountAppId, redirectUri: config.redirectUri },
});

await wechat.signIn();
```

React hooks accept this client directly or through `WeChatAuthProvider`. Working examples for
Next.js, React, Vue, Angular, Svelte, vanilla JavaScript, and React with a custom Python backend are
listed in [`examples`](./examples).

## Expo

The Expo package provides `configure()`, `WeChatAuth.*`, and the root, `/react`, `/advanced`, `/better-auth/client`, and `/plugin` entry points. Import backend helpers and the Better Auth server plugin from `@chinafast/wechat-auth-server`.

## Security

Client configuration only accepts app IDs and redirect URIs. App secrets exist exclusively in the server package. Browser pending state correlates a callback locally; the server must separately create and atomically consume state before exchanging a code.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```
