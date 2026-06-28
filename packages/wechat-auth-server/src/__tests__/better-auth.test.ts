import { describe, expect, it, vi } from "vitest";

import { createWeChatAccountId, wechatPlugin } from "../better-auth.js";
import type { WeChatStateStore } from "../index.js";

const credentials = {
  openPlatform: { appId: "wx-app", secret: "secret" },
};

describe("wechatPlugin", () => {
  it("uses an app-scoped openid as the stable account key", () => {
    expect(createWeChatAccountId("wx-app", "openid-1")).toBe("wx-app:openid-1");
  });

  it("exposes the state and sign-in endpoints", () => {
    const stateStore: WeChatStateStore = {
      create: async () => ({ state: "state-1", expiresAt: 123 }),
      consume: async () => ({ ok: true }),
    };

    const plugin = wechatPlugin({ credentials, stateStore });

    expect(plugin.id).toBe("wechat");
    expect(plugin.endpoints.createWeChatState.path).toBe("/wechat/state");
    expect(plugin.endpoints.signInWithWeChat.path).toBe("/wechat/sign-in");
  });

  it("creates state through an async store", async () => {
    const stateStore: WeChatStateStore = {
      create: vi.fn<WeChatStateStore["create"]>(async () => ({
        state: "state-1",
        expiresAt: 123,
      })),
      consume: async () => ({ ok: true }),
    };
    const endpoint = wechatPlugin({ credentials, stateStore }).endpoints.createWeChatState;

    const result = await endpoint({ json: (body: unknown) => body } as never);

    expect(result).toEqual({ state: "state-1", expiresAt: 123 });
    expect(stateStore.create).toHaveBeenCalledOnce();
  });

  it("rejects an invalid state before exchanging the code", async () => {
    const stateStore: WeChatStateStore = {
      create: async () => ({ state: "state-1", expiresAt: 123 }),
      consume: vi.fn<WeChatStateStore["consume"]>(async () => ({
        ok: false,
        reason: "not_found",
      })),
    };
    const endpoint = wechatPlugin({ credentials, stateStore }).endpoints.signInWithWeChat;

    await expect(
      endpoint({
        body: {
          code: "code-1",
          state: "invalid",
          flow: "native_app",
          redirectUri: "wechatdemo://wechat-auth/callback",
        },
      } as never)
    ).rejects.toThrow("Invalid state.");
    expect(stateStore.consume).toHaveBeenCalledWith("invalid");
  });
});
