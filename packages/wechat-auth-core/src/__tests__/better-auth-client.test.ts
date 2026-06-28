import { describe, expect, it, vi } from "vitest";
import { wechatClient } from "../better-auth-client.js";
import type { WeChatAuthClient } from "../client.js";
import type { WeChatSignInInput } from "../types.js";

describe("wechatClient", () => {
  it("routes state creation and code exchange through Better Auth", async () => {
    const $fetch = vi.fn<
      (
        path: string,
        options: { method: string; body?: unknown }
      ) => Promise<{
        data: { state: string } | { session: string };
        error: null;
      }>
    >(async (path) => ({
      data: path === "/wechat/state" ? { state: "state-1" } : { session: "session-1" },
      error: null,
    }));
    const signIn = vi.fn<
      <TSession>(input?: WeChatSignInInput) => Promise<{
        status: "success";
        auth: {
          status: "success";
          code: string;
          state: string;
          provider: "wechat_open_platform";
          flow: "native_app";
          scope: "profile";
          redirectUri: string;
          environment: {
            platform: "ios";
            device: "mobile";
            browser: "unknown";
            runtime: "standalone";
            supports: {
              nativeWeChatSdk: boolean;
              deepLink: boolean;
              universalLink: boolean;
              qrLogin: boolean;
              officialAccountOAuth: boolean;
              webRedirect: boolean;
            };
          };
        };
        session: TSession;
      }>
    >(async <TSession>(input?: WeChatSignInInput) => ({
      status: "success" as const,
      auth: {
        status: "success" as const,
        code: "code-1",
        state: input?.state || "",
        provider: "wechat_open_platform" as const,
        flow: "native_app" as const,
        scope: "profile" as const,
        redirectUri: "wechatdemo://wechat-auth/callback",
        environment: {
          platform: "ios" as const,
          device: "mobile" as const,
          browser: "unknown" as const,
          runtime: "standalone" as const,
          supports: {
            nativeWeChatSdk: true,
            deepLink: true,
            universalLink: true,
            qrLogin: false,
            officialAccountOAuth: false,
            webRedirect: false,
          },
        },
      },
      session: (await input?.exchange?.({
        code: "code-1",
        state: input.state || "",
        flow: "native_app",
        redirectUri: "wechatdemo://wechat-auth/callback",
      })) as TSession,
    }));
    const client = { signIn } as unknown as WeChatAuthClient;
    const actions = wechatClient({ client }).getActions($fetch as never);

    const result = await actions.signIn.wechat<{ session: string }>({ scope: "profile" });

    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({ state: "state-1", exchangeUrl: "/api/auth/wechat/sign-in" })
    );
    expect($fetch).toHaveBeenNthCalledWith(1, "/wechat/state", { method: "GET" });
    expect($fetch).toHaveBeenNthCalledWith(2, "/wechat/sign-in", {
      method: "POST",
      body: {
        code: "code-1",
        state: "state-1",
        flow: "native_app",
        redirectUri: "wechatdemo://wechat-auth/callback",
      },
    });
    expect(result.status).toBe("success");
  });
});
