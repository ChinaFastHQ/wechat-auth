# Expo + Express + Better Auth example

This example uses the package's Better Auth server plugin. The plugin validates one-time state,
exchanges the WeChat code, links a Better Auth account, creates a database session, and sets Better
Auth's session cookie. Better Auth's Expo client persists that cookie in SecureStore on native
platforms and exposes the session through `useSession()`.

## Configuration

1. Copy `.env.example` to `.env` and provide the WeChat app ID/secret pairs for the flows you use.
2. Set a random `BETTER_AUTH_SECRET` of at least 32 characters.
3. Copy `expo-app/.env.example` to `expo-app/.env` and set the public app IDs.
4. Set redirect URIs in `expo-app/App.tsx`; update the universal link or scheme in
   `expo-app/app.config.ts` when needed.

Keep WeChat secrets in the Express environment only. For local Expo web, register
`http://localhost:8081/wechat-auth/callback`. The Express callback is an optional relay.

## Run

```bash
cp examples/better-auth-example/express-server/.env.example examples/better-auth-example/express-server/.env
cp examples/better-auth-example/expo-app/.env.example examples/better-auth-example/expo-app/.env
pnpm --filter expo-wechat-auth-better-auth-express-example db:migrate
pnpm --filter expo-wechat-auth-better-auth-express-example dev
pnpm --filter expo-wechat-auth-better-auth-expo-example web
```

Run the migration once, then run the server and app in separate terminals. The default SQLite file
is `better-auth.sqlite` in the server's current working directory.

## Request flow

1. `signIn()` obtains state from Better Auth's `GET /api/auth/wechat/state` endpoint.
2. The SDK authorizes with WeChat, receives the callback through its installed handler, and sends
   the result to `POST /api/auth/wechat/sign-in`.
3. The server plugin consumes state, performs the real WeChat token/profile requests, and finds or
   creates the Better Auth user and account.
4. Better Auth creates a session. The browser stores its cookie normally; on native, the Better
   Auth Expo client stores it in SecureStore and refreshes the reactive session state.

The packaged `wechatPlugin()` and `wechatClient()` plugins expose this flow; application code does
not need to implement the server endpoints or manually call the state or exchange endpoints. The
client starts it with `authClient.signIn.wechat({ scope: "profile" })`.

For production, use a durable database, a shared state store, HTTPS, restricted trusted origins and
CORS, and a secret manager. The generated `.invalid` email is only a provider placeholder; adapt
the account model if your application requires verified user email addresses.
