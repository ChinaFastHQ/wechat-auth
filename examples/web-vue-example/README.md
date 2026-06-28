# Vue + Express example

Copy `.env.example` to `.env`, fill in the app IDs and secrets, and register
`http://localhost:5174/` with WeChat. Run the Vue app on `5174` and Express on `4102` with:

```bash
pnpm --filter web-wechat-auth-vue-example dev
```

The frontend uses Vue's Composition API and the framework-neutral browser client.
