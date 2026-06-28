# Examples

The repository includes native Expo/Express examples and browser examples for the major web
frameworks. Run one native example at a time because the Expo apps all use Metro's default port
(`8081`).

| Example                                        | Session implementation                | Server port |
| ---------------------------------------------- | ------------------------------------- | ----------- |
| [`minimal-example`](./minimal-example)         | In-memory users and signed JWT cookie | `4000`      |
| [`better-auth-example`](./better-auth-example) | Better Auth with SQLite               | `4001`      |
| [`passportjs-example`](./passportjs-example)   | Passport.js with `express-session`    | `4002`      |
| [`full-stack-example`](./full-stack-example)   | Better Auth, MySQL, and Redis         | `4003`      |

## Browser examples

| Example                                                  | Framework          | What it demonstrates                         |
| -------------------------------------------------------- | ------------------ | -------------------------------------------- |
| [`web-nextjs-example`](./web-nextjs-example)             | Next.js            | SSR-safe React client plus Express backend   |
| [`web-react-example`](./web-react-example)               | React SPA          | Provider/hooks plus Express backend          |
| [`web-vue-example`](./web-vue-example)                   | Vue                | Composition API plus Express backend         |
| [`web-angular-example`](./web-angular-example)           | Angular            | Standalone component plus Express backend    |
| [`web-svelte-example`](./web-svelte-example)             | Svelte             | Svelte lifecycle plus Express backend        |
| [`web-vanilla-example`](./web-vanilla-example)           | Vanilla JavaScript | Framework-free client plus Express backend   |
| [`web-react-python-example`](./web-react-python-example) | React + Python     | Complete sign-in with a custom Flask backend |

Each browser example is self-contained and includes server-side one-time state, WeChat token
exchange, and profile lookup. The first six use a basic Express server; the React/Python example
implements the same boundary in Flask without using the JavaScript server package.

The examples perform real WeChat authorization-code exchanges. Before running one, copy its
`.env.example` to `.env` and configure the app IDs and server-only secrets. Native examples keep
separate environment files in their app and server directories. The redirect URI sent by the app
must exactly match a callback URL registered with WeChat.

Each example README explains its request flow and storage. The full-stack example demonstrates
durable application infrastructure; its README also lists the operational controls still required
for a production deployment.
