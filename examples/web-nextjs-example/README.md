# Next.js + Express example

Copy `.env.example` to `.env`, fill in the public app IDs and server-only secrets, and register
`http://localhost:3000/` with WeChat. Run both Next.js and Express with:

```bash
pnpm --filter web-wechat-auth-nextjs-example dev
```

Next.js runs on port `3000` and Express on `4100`. Browser access remains isolated in a client
component, while Express creates one-time state and exchanges the authorization code.
