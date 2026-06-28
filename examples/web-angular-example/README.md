# Angular + Express example

Replace the two public placeholder app IDs in `src/main.ts`, copy `.env.example` to `.env`, add
the matching server secrets, and register `http://localhost:4200/` with WeChat. Run Angular on
`4200` and Express on `4105`:

```bash
pnpm --filter web-wechat-auth-angular-example dev
```

Public configuration stays in source because Angular environment replacement is
application-specific; secrets stay exclusively in `.env` for Express.
