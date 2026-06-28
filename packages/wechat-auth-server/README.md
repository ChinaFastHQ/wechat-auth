# @chinafast/wechat-auth-server

Server-only helpers for WeChat credential selection, authorization-code exchange, profile lookup, and one-time state validation.

```ts
import { createMemoryStateStore, exchangeWeChatCode } from "@chinafast/wechat-auth-server";
```

The Better Auth server plugin has an isolated entry point:

```ts
import { wechatPlugin } from "@chinafast/wechat-auth-server/better-auth";
```

Use a shared, atomic `WeChatStateStore` implementation such as Redis when running multiple production server instances. Never expose WeChat app secrets to browser or native client code.
