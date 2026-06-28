# React SPA + Express example

Copy `.env.example` to `.env`, fill in the app IDs and secrets, and register
`http://localhost:5173/` with WeChat. Then run both Vite and Express:

```bash
pnpm --filter web-wechat-auth-react-example dev
```

Vite runs on port `5173` and Express on `4101`. The frontend demonstrates the optional React
provider and hooks; the backend performs state validation and code exchange.
