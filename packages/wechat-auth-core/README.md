# @chinafast/wechat-auth-core

Portable, framework-free WeChat authentication orchestration. Runtime effects are supplied through `WeChatAuthRuntime`; most applications should use the Expo or web package instead.

Pending browser state correlates the local callback. A server integration must also create and atomically consume state before exchanging a code, because browser storage is not a server-side security boundary.
