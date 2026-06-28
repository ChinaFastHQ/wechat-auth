import {
  wechatClient as createWeChatClient,
  type BetterAuthWeChatSignInInput,
  type WeChatClientOptions as CoreWeChatClientOptions,
} from "@chinafast/wechat-auth-core/better-auth/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { WeChatAuth } from "./core.js";
import type { WeChatSignInResult } from "./types.js";

export type { BetterAuthWeChatSignInInput } from "@chinafast/wechat-auth-core/better-auth/client";
export type WeChatClientOptions = Omit<CoreWeChatClientOptions, "client">;
type GetActions = NonNullable<BetterAuthClientPlugin["getActions"]>;
type ExpoWeChatClientPlugin = {
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

export function wechatClient(options: WeChatClientOptions = {}): ExpoWeChatClientPlugin {
  return createWeChatClient({
    ...options,
    client: WeChatAuth,
  }) as unknown as ExpoWeChatClientPlugin;
}
