# Expo + Express + Passport.js example

This example defines a small Passport strategy that validates state, exchanges a WeChat code, and
passes the resulting user to Passport. Passport serializes the user ID into an `express-session`
cookie.

## Configuration

1. Copy the server's `.env.example` to `.env` and set the credentials for each WeChat flow you use.
2. Copy `expo-app/.env.example` to `expo-app/.env` and set the public app IDs.
3. Set redirect URIs in `expo-app/App.tsx`; update the universal link or scheme in
   `expo-app/app.config.ts` when needed.
4. Register `http://localhost:8081/wechat-auth/callback` for local Expo web. The Express callback
   remains available as an optional relay.

Never expose a WeChat app secret in Expo source or configuration; only Express needs it.

## Run

```bash
cp examples/passportjs-example/express-server/.env.example examples/passportjs-example/express-server/.env
cp examples/passportjs-example/expo-app/.env.example examples/passportjs-example/expo-app/.env
pnpm --filter expo-wechat-auth-passportjs-express-example dev
pnpm --filter expo-wechat-auth-passportjs-expo-example web
```

Run the server and app in separate terminals.

## Request flow

1. `signIn()` obtains one-time state from `GET /auth/wechat/state`.
2. The SDK completes the appropriate WeChat authorization flow.
3. The installed handler receives the callback and the SDK submits it to `POST /auth/wechat`,
   which invokes `WeChatStrategy`.
4. The strategy consumes state, exchanges the real code, fetches the profile, and calls Passport
   with the mapped user.
5. Passport serializes the internal user ID into the `express-session` session.

The example's state, user, and session stores are process-local. Replace them with shared durable
stores, enable secure cookies behind HTTPS, restrict CORS, and rotate strong secrets in production.
