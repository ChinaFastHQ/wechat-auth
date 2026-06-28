# Expo + Express full-stack example

This is the production-shaped example: an Expo app signs in with WeChat, Express and Better Auth
own the account/session lifecycle, MySQL persists auth and editable profile data, and Redis stores
one-time OAuth state. Better Auth's Expo client supports browser cookies and securely persists
native session cookies in SecureStore.

## What is included

- Better Auth's React client for reactive sessions, authenticated API requests, and sign-out.
- A profile screen that edits the Better Auth display name plus app-owned `bio` and `locale`
  fields. The server saves both in one transaction.
- MySQL 8.4 with durable Docker storage and initialization SQL for Better Auth and `profile`.
- Redis 7.4 with append-only persistence and atomic `GETDEL` OAuth state consumption.
- Exact-origin credentialed CORS, server-side validation, and graceful connection shutdown.

## Configure

1. Copy `express-server/.env.example` to `express-server/.env` and fill in the WeChat credentials.
2. Replace `BETTER_AUTH_SECRET` with at least 32 random characters.
3. Copy `expo-app/.env.example` to `expo-app/.env` and set the public app IDs.
4. Set redirect URIs in `expo-app/App.tsx`; update the universal link or scheme in
   `expo-app/app.config.ts` when needed.

The browser callback registered with WeChat should be
`http://localhost:8081/wechat-auth/callback` for local Expo web. The Express callback remains an
optional relay. Secrets belong only in the server `.env`; WeChat app IDs are public client
configuration.

The app calls the high-level `signIn()` method. The SDK obtains Redis-backed state from Better
Auth, handles the return URL through `installLinkingHandler()`, and exchanges the code without an
auth-specific React effect.

## Run

From the repository root:

```bash
cp examples/full-stack-example/express-server/.env.example examples/full-stack-example/express-server/.env
cp examples/full-stack-example/expo-app/.env.example examples/full-stack-example/expo-app/.env
docker compose -f examples/full-stack-example/docker-compose.yml up -d
pnpm --filter expo-wechat-auth-full-stack-express-example dev
pnpm --filter expo-wechat-auth-full-stack-expo-example web
```

Run the server and app commands in separate terminals. MySQL is exposed on `localhost:3307`,
Redis on `localhost:6380`, the API on `localhost:4003`, and Expo web on `localhost:8081`.

For a physical device, replace `localhost` in the client API URL and registered redirect URI with
an HTTPS address reachable by the device. Native WeChat integration requires a development build;
it does not work in Expo Go.

To stop the infrastructure without deleting data:

```bash
docker compose -f examples/full-stack-example/docker-compose.yml down
```

The named volumes deliberately retain accounts, sessions, profiles, and Redis state. Use `down -v`
only when you intentionally want a clean database.

## Data ownership

Better Auth owns `user`, `session`, `account`, and `verification`. The application owns `profile`,
keyed one-to-one by `user.id`. A display name is identity data and therefore stays on `user`; bio
and locale are application concerns and stay on `profile`.

This example is suitable as an application starting point, but deployment still requires TLS,
managed secrets, database backups, private database/Redis networking, credential rotation,
monitoring, and environment-specific CORS/trusted origins.
