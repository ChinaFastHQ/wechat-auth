import type { WeChatAuthFlow } from "@chinafast/wechat-auth-core";
import {
  credentialsForFlow,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  type WeChatServerCredentials,
  type WeChatUserInfo,
} from "@chinafast/wechat-auth-server";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

import { createRedisStateStore, type RedisStateClient } from "./redis-state-store.js";

const bodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  flow: z.enum(["native_app", "desktop_qr", "wechat_browser_oauth"]).optional(),
  redirectUri: z.string().min(1),
});

type WeChatPluginOptions = {
  credentials: WeChatServerCredentials;
  redis: RedisStateClient;
};

export function wechatPlugin(options: WeChatPluginOptions) {
  const stateStore = createRedisStateStore(options.redis);

  return {
    id: "wechat",
    endpoints: {
      createWeChatState: createAuthEndpoint("/wechat/state", { method: "GET" }, async (ctx) =>
        ctx.json(await stateStore.create())
      ),
      signInWithWeChat: createAuthEndpoint(
        "/wechat/sign-in",
        { method: "POST", body: bodySchema },
        async (ctx) => {
          if (!(await stateStore.consume(ctx.body.state))) {
            throw new APIError("BAD_REQUEST", { message: "Invalid or expired state." });
          }

          const token = await exchangeWeChatCode(
            { code: ctx.body.code, flow: ctx.body.flow as WeChatAuthFlow | undefined },
            { credentials: options.credentials }
          );
          const profile: WeChatUserInfo = await fetchWeChatUserInfo(token);
          const appId = credentialsForFlow(
            options.credentials,
            ctx.body.flow as WeChatAuthFlow | undefined
          )?.appId;
          if (!appId) {
            throw new APIError("BAD_REQUEST", { message: "Invalid WeChat auth flow." });
          }
          const accountId = `${appId}:${profile.openid}`;
          const existingAccount = await ctx.context.internalAdapter.findAccountByProviderId(
            accountId,
            "wechat"
          );

          let user;
          if (existingAccount) {
            user = await ctx.context.internalAdapter.findUserById(existingAccount.userId);
            if (!user) {
              throw new APIError("INTERNAL_SERVER_ERROR", { message: "User not found." });
            }
            await ctx.context.internalAdapter.updateAccount(existingAccount.id, {
              accessToken: token.access_token,
              refreshToken: token.refresh_token,
              scope: token.scope,
            });
          } else {
            const created = await ctx.context.internalAdapter.createOAuthUser(
              {
                name: profile.nickname || "WeChat User",
                image: profile.headimgurl,
                email: `wechat-${appId}-${profile.openid}@wechat.invalid`,
                emailVerified: true,
              },
              {
                providerId: "wechat",
                accountId,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                scope: token.scope,
              }
            );
            user = created.user;
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user, session: session.token });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}
