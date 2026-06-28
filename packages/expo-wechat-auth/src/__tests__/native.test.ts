import { describe, expect, it, vi } from "vitest";

import { ReactNativeModuleWeChatAuthProvider } from "../native/NativeWeChatAuthProvider";

const nativeModule = vi.hoisted(() => ({
  isInstalled: vi.fn<() => Promise<boolean>>(async () => true),
  isAvailable: vi.fn<() => Promise<boolean>>(async () => true),
  authorize: vi.fn<
    (input: { state: string }) => Promise<{ code: string; state: string; errorCode: number }>
  >(async (input) => ({ code: "bundled-code", state: input.state, errorCode: 0 })),
}));

vi.mock("expo", () => ({ requireNativeModule: () => nativeModule }));

const environment = {
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
};

describe("ReactNativeModuleWeChatAuthProvider", () => {
  it("uses the bundled WeChat native bridge", async () => {
    const provider = new ReactNativeModuleWeChatAuthProvider();

    await expect(
      provider.authorize({
        scope: "profile",
        state: "state-1",
        appId: "wx-app",
        universalLink: "https://example.com/app/",
        redirectUri: "demo://wechat",
        environment,
      })
    ).resolves.toMatchObject({ code: "bundled-code", state: "state-1" });
    expect(nativeModule.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "wx-app",
        universalLink: "https://example.com/app/",
        wechatScope: "snsapi_userinfo",
        state: "state-1",
      })
    );
  });

  it("requires the native SDK response to return OAuth state", async () => {
    const provider = new ReactNativeModuleWeChatAuthProvider(async () => ({
      isAvailable: () => true,
      authorize: async () => ({ code: "code-1", errCode: 0 }),
    }));

    await expect(
      provider.authorize({
        scope: "profile",
        state: "state-1",
        appId: "wx-app",
        redirectUri: "demo://wechat",
        environment,
      })
    ).rejects.toThrow("did not return OAuth state");
  });

  it("returns a verified native authorization result", async () => {
    const provider = new ReactNativeModuleWeChatAuthProvider(async () => ({
      isAvailable: () => true,
      authorize: async () => ({ code: "code-1", state: "state-1", errCode: 0 }),
    }));

    await expect(
      provider.authorize({
        scope: "profile",
        state: "state-1",
        appId: "wx-app",
        redirectUri: "demo://wechat",
        environment,
      })
    ).resolves.toMatchObject({ status: "success", code: "code-1", state: "state-1" });
  });
});
