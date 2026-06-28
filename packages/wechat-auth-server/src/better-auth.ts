import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";
import type { WeChatAuthFlow } from "@chinafast/wechat-auth-core";
import {
  credentialsForFlow,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  type WeChatServerCredentials,
  type WeChatStateStore,
  type WeChatUserInfo,
} from "./index.js";

const bodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  flow: z.enum(["native_app", "desktop_qr", "wechat_browser_oauth"]).optional(),
  redirectUri: z.string().min(1),
});
export type WeChatPluginOptions = {
  credentials: WeChatServerCredentials;
  stateStore: WeChatStateStore;
};

export function createWeChatAccountId(appId: string, openid: string): string {
  return `${appId}:${openid}`;
}

function accountId(
  options: WeChatPluginOptions,
  flow: WeChatAuthFlow | undefined,
  profile: WeChatUserInfo
): string {
  const appId = credentialsForFlow(options.credentials, flow)?.appId;
  if (!appId) {
    throw new APIError("BAD_REQUEST", { message: "Invalid WeChat auth flow." });
  }
  return createWeChatAccountId(appId, profile.openid);
}

export function wechatPlugin(options: WeChatPluginOptions) {
  return {
    id: "wechat",
    endpoints: {
      createWeChatState: createAuthEndpoint("/wechat/state", { method: "GET" }, async (ctx) =>
        ctx.json(await options.stateStore.create())
      ),
      signInWithWeChat: createAuthEndpoint(
        "/wechat/sign-in",
        { method: "POST", body: bodySchema },
        async (ctx) => {
          const state = await options.stateStore.consume(ctx.body.state);
          if (!state.ok) {
            throw new APIError("BAD_REQUEST", {
              message: state.reason === "expired" ? "State expired." : "Invalid state.",
            });
          }
          const flow = ctx.body.flow as WeChatAuthFlow | undefined;
          const token = await exchangeWeChatCode(
            { code: ctx.body.code, flow },
            { credentials: options.credentials }
          );
          const profile = await fetchWeChatUserInfo(token);
          const stableId = accountId(options, flow, profile);
          let existing = await ctx.context.internalAdapter.findAccountByProviderId(
            stableId,
            "wechat"
          );
          if (!existing && profile.unionid) {
            existing = await ctx.context.internalAdapter.findAccountByProviderId(
              profile.unionid,
              "wechat"
            );
          }
          if (!existing) {
            existing = await ctx.context.internalAdapter.findAccountByProviderId(
              profile.openid,
              "wechat"
            );
          }
          let user;
          if (existing) {
            user = await ctx.context.internalAdapter.findUserById(existing.userId);
            if (!user) {
              throw new APIError("INTERNAL_SERVER_ERROR", { message: "User not found." });
            }
            await ctx.context.internalAdapter.updateAccount(existing.id, {
              accessToken: token.access_token,
              refreshToken: token.refresh_token,
              scope: token.scope,
            });
          } else {
            const appId = credentialsForFlow(options.credentials, flow)?.appId;
            const created = await ctx.context.internalAdapter.createOAuthUser(
              {
                name: profile.nickname || "WeChat User",
                image: profile.headimgurl,
                email: `wechat-${appId}-${profile.openid}@wechat.invalid`,
                emailVerified: true,
              },
              {
                providerId: "wechat",
                accountId: stableId,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                scope: token.scope,
              }
            );
            user = created.user;
          }
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user, session });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}
