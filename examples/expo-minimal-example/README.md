# Minimal Expo + Express example

This dependency-light example shows the authentication plumbing without an auth framework. Express
exchanges the WeChat authorization code, stores the resulting user in memory, and signs a JWT. The
JWT is returned as both an HTTP-only cookie for web and a response value for native clients.

## Configuration

1. Register the required native, website, or official-account application with WeChat.
2. Copy the server environment template and set the app ID/secret pair for every flow you use.
3. Copy `expo-app/.env.example` to `expo-app/.env` and set the public app IDs.
4. Set redirect URIs in `expo-app/App.tsx`; update the universal link or scheme in
   `expo-app/app.config.ts` when needed.

App secrets belong only in the server `.env`; never put them in the Expo configuration or source.
For local Expo web, register `http://localhost:8081/wechat-auth/callback`. The optional Express
callback route is only a relay for deployments that cannot register the app URL directly.

## Run

```bash
cp examples/minimal-example/express-server/.env.example examples/minimal-example/express-server/.env
cp examples/minimal-example/expo-app/.env.example examples/minimal-example/expo-app/.env
pnpm --filter expo-wechat-auth-minimal-express-example dev:direct
pnpm --filter expo-wechat-auth-minimal-expo-example web:direct
```

Run the server and app commands in separate terminals. The default URLs are
`http://localhost:4000` and `http://localhost:8081`.

## Request flow

1. `signIn()` obtains one-time state from `GET /auth/wechat/state`.
2. The SDK selects the native, QR, mobile-web, or WeChat-browser flow and opens WeChat.
3. `installLinkingHandler()` receives the app callback; the component needs no callback effect.
4. The SDK posts the code, state, flow, and redirect URI to `POST /auth/wechat`.
5. Express consumes the state, exchanges the real code with WeChat, fetches the profile, and creates
   the demo JWT session.

The state, user, and session implementations are intentionally process-local. Production code
needs durable shared state, persistent users, session revocation, strong secrets, HTTPS, and a
restricted CORS origin.
