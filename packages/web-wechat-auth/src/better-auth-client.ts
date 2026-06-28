import {
  wechatClient as createWeChatClient,
  type BetterAuthWeChatSignInInput,
  type WeChatClientOptions,
} from "@chinafast/wechat-auth-core/better-auth/client";
import type { WeChatSignInResult } from "@chinafast/wechat-auth-core";
import type { BetterAuthClientPlugin } from "better-auth/client";

export type {
  BetterAuthWeChatSignInInput,
  WeChatClientOptions,
} from "@chinafast/wechat-auth-core/better-auth/client";

type GetActions = NonNullable<BetterAuthClientPlugin["getActions"]>;
type WebWeChatClientPlugin = {
  id: "wechat-client";
  getActions(
    fetch: Parameters<GetActions>[0],
    store: Parameters<GetActions>[1],
    options: Parameters<GetActions>[2]
  ): {
    signIn: {
      wechat<TSession = unknown>(
        input?: BetterAuthWeChatSignInInput
      ): Promise<WeChatSignInResult<TSession>>;
    };
  };
};

export function wechatClient(options: WeChatClientOptions): WebWeChatClientPlugin {
  return createWeChatClient(options) as unknown as WebWeChatClientPlugin;
}
