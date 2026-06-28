# @chinafast/expo-wechat-auth

Client-side TypeScript helpers for WeChat sign-in from Expo and React Native apps. The package selects the right WeChat authorization flow, stores and validates local `state`, parses redirect callbacks, and can exchange a successful authorization code with your backend for an app session.

`WeChatAuth.installLinkingHandler()` can install an idempotent Expo deep-link handler for native callbacks.

## Install

```bash
pnpm add @chinafast/expo-wechat-auth
```

## Basic Usage

```ts
import * as Linking from "expo-linking";
import { WeChatAuth } from "@chinafast/expo-wechat-auth";
import { useWeChatAuth } from "@chinafast/expo-wechat-auth/react";

const API_URL = "http://localhost:4000";
const OPEN_APP_ID = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID!;
const WEB_APP_ID = process.env.EXPO_PUBLIC_WECHAT_WEB_APP_ID!;
const MP_APP_ID = process.env.EXPO_PUBLIC_WECHAT_MP_APP_ID!;

WeChatAuth.configure({
  exchangeUrl: `${API_URL}/auth/wechat`,
  native: {
    appId: OPEN_APP_ID,
    redirectUri: Linking.createURL("wechat-auth/callback"),
    universalLink: "https://example.com/app/",
  },
  web: {
    appId: WEB_APP_ID,
    redirectUri: "http://localhost:8081/wechat-auth/callback",
  },
  officialAccount: {
    appId: MP_APP_ID,
    redirectUri: "http://localhost:8081/wechat-auth/callback",
  },
  scheme: "wechatdemo",
  debug: true,
});

WeChatAuth.installLinkingHandler();

type SessionPayload = {
  user: unknown;
  session: string;
};

function SignInButton() {
  const { signIn, loading, error, environment, pendingAuth } = useWeChatAuth();

  async function startSignIn() {
    const result = await signIn<SessionPayload>({ scope: "profile" });
    if (result.status === "success") console.log(result.auth, result.session);
  }

  return <button onClick={startSignIn} disabled={loading}>Sign in with WeChat</button>;
}
```

`signIn()` obtains one-time state from the backend, starts authorization, and posts `{ code, state, flow, redirectUri }` to `exchangeUrl` with credentials. Full-page browser redirects persist the exchange URL so callback handling can establish the session after a reload. By default the state endpoint is `<exchangeUrl>/state`; a trailing `/sign-in` is replaced with `/state`. Advanced integrations can set `stateUrl` explicitly.

Use `authorize()` when you only want the raw WeChat authorization result/code. `WeChatAuth.installLinkingHandler()` installs one idempotent Expo link listener, handles initial callback URLs, and returns an idempotent cleanup function. App components do not need callback effects or code-exchange requests. Your backend must keep the WeChat `AppSecret`, validate state and CSRF, exchange the code, create sessions, and store tokens.

Framework-agnostic backend helpers for code exchange, profile lookup, credential selection, and in-memory one-time state validation are exported from `@chinafast/wechat-auth-server`.

Per-call exchange endpoints are still supported:

```ts
await signIn({
  scope: "profile",
  exchangeUrl: "/custom/wechat/sign-in",
});
```

## Better Auth Server

Use the packaged server plugin with an explicit state store:

```ts
import { wechatPlugin } from "@chinafast/wechat-auth-server/better-auth";
import { createMemoryStateStore } from "@chinafast/wechat-auth-server";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database,
  plugins: [
    wechatPlugin({
      credentials: {
        openPlatform: { appId: process.env.WECHAT_APP_ID!, secret: process.env.WECHAT_APP_SECRET! },
      },
      stateStore: createMemoryStateStore(),
    }),
  ],
});
```

The memory store is suitable for development and single-process deployments. Supply a
`WeChatStateStore` backed by shared storage such as Redis in multi-instance production deployments.

## Better Auth Client

Add the packaged client plugin after Better Auth's Expo plugin:

```ts
import { expoClient } from "@better-auth/expo/client";
import { wechatClient } from "@chinafast/expo-wechat-auth/better-auth/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "http://localhost:4001",
  plugins: [expoClient({ storage: SecureStore }), wechatClient()],
});

await authClient.signIn.wechat({ scope: "profile" });
```

`wechatClient()` sends both the state and code-exchange requests through Better Auth's client. On
native platforms, `@better-auth/expo` can therefore persist the resulting session cookie and expose
the session through `authClient.useSession()`.

## Expo Config Plugin

```ts
const appId = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
if (!appId) {
  throw new Error("EXPO_PUBLIC_WECHAT_OPEN_APP_ID is required");
}

export default {
  expo: {
    plugins: [
      [
        "@chinafast/expo-wechat-auth/plugin",
        {
          wechat: {
            appId,
            universalLink: "https://example.com/app/",
            androidPackageName: "cn.example.app",
            iosBundleIdentifier: "cn.example.app",
          },
          scheme: "myapp",
        },
      ],
    ],
  },
};
```

Expo Go cannot support real native WeChat SDK login. Use an Expo dev client or EAS prebuild. The package includes its own auth-only Expo native module; the config plugin generates the required iOS link configuration and Android `WXEntryActivity` callback setup.

## Security Notes

- Never put a WeChat `AppSecret` in client code.
- Callback state is checked against local pending state by default and expires after 10 minutes.
- Set `requireStoredState: false` only when another layer owns state validation.
- `generateState()` requires `globalThis.crypto.getRandomValues`; provide `state` yourself or add a crypto polyfill if your runtime lacks it.

## License

MIT
