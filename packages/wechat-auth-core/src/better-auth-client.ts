import type { BetterAuthClientPlugin } from "better-auth/client";
import type { WeChatAuthClient } from "./client.js";
import type { WeChatSignInInput, WeChatSignInResult } from "./types.js";

type GetActions = NonNullable<BetterAuthClientPlugin["getActions"]>;

export type WeChatClientOptions = {
  client: WeChatAuthClient;
  statePath?: string;
  signInPath?: string;
  redirectSignInUrl?: string;
};

export type BetterAuthWeChatSignInInput = Omit<
  WeChatSignInInput,
  "exchange" | "exchangeUrl" | "stateUrl"
>;

function message(error: unknown, fallback: string): string {
  return error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
    ? error.message
    : fallback;
}

export function wechatClient(options: WeChatClientOptions) {
  const statePath = options.statePath || "/wechat/state";
  const signInPath = options.signInPath || "/wechat/sign-in";
  const redirectSignInUrl = options.redirectSignInUrl || `/api/auth${signInPath}`;
  return {
    id: "wechat-client",
    getActions($fetch: Parameters<GetActions>[0]) {
      return {
        signIn: {
          wechat: async <TSession = unknown>(
            input: BetterAuthWeChatSignInInput = {}
          ): Promise<WeChatSignInResult<TSession>> => {
            try {
              let state = input.state;
              if (!state) {
                const response = await $fetch<{ state: string }>(statePath, { method: "GET" });
                if (response.error) {
                  throw new Error(
                    message(response.error, "Could not create WeChat sign-in state.")
                  );
                }
                state = response.data?.state;
              }
              if (!state) {
                throw new Error("The WeChat state endpoint did not return a state string.");
              }
              return options.client.signIn<TSession>({
                ...input,
                state,
                exchangeUrl: redirectSignInUrl,
                exchange: async (body) => {
                  const response = await $fetch<TSession>(signInPath, { method: "POST", body });
                  if (response.error) {
                    throw new Error(
                      message(response.error, "Could not exchange the WeChat authorization code.")
                    );
                  }
                  return response.data as TSession;
                },
              });
            } catch (error) {
              return {
                status: "error",
                error: {
                  code: "BETTER_AUTH_ERROR",
                  message: message(error, "Better Auth WeChat sign-in failed."),
                },
              };
            }
          },
        },
      };
    },
  } satisfies BetterAuthClientPlugin;
}
