import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WeChatAuth,
  configure,
  createWeChatAuth,
  createAuthUrl,
  detectEnvironment,
  handleRedirectCallback,
} from "../index";
import {
  addAuthListener,
  clearPendingAuth,
  generateState,
  getPendingAuth,
  mapScopeToWechat,
  resolveFlow,
} from "../advanced";
import { useWeChatAuth } from "../react";
import { clearListenersForTests } from "../listeners";
import { resetConfigForTests } from "../config";
import { setExpoLinkingModuleForTests } from "../core";
import type { WeChatSessionExchangeInput } from "../types";

afterEach(() => {
  clearPendingAuth();
  clearListenersForTests();
  setExpoLinkingModuleForTests(undefined);
  resetConfigForTests();
  vi.restoreAllMocks();
});

function configureWeb() {
  configure({
    web: { appId: "wx_web", redirectUri: "https://example.com/auth/wechat/callback" },
    officialAccount: { appId: "wx_mp", redirectUri: "https://example.com/auth/wechat/callback" },
  });
}

describe("expo-wechat-auth", () => {
  it("configures and detects desktop web", () => {
    configureWeb();
    const env = detectEnvironment();
    expect(env.platform).toBe("web");
    expect(env.supports.qrLogin).toBe(true);
  });

  it("resolves desktop web to QR login", () => {
    configureWeb();
    const resolved = resolveFlow();
    expect(resolved.flow).toBe("desktop_qr");
    expect(resolved.provider).toBe("wechat_open_platform");
  });

  it("resolves WeChat browser to Official Account OAuth", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 iPhone MicroMessenger"
    );
    configureWeb();
    const resolved = resolveFlow();
    expect(resolved.flow).toBe("wechat_browser_oauth");
    expect(resolved.provider).toBe("wechat_official_account");
  });

  it("rejects the unsupported external mobile browser flow", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 iPhone Safari");
    configureWeb();
    expect(() => resolveFlow()).toThrow("not supported in this environment");
  });

  it("maps public scopes to WeChat scopes", () => {
    expect(mapScopeToWechat("wechat_browser_oauth", "base")).toBe("snsapi_base");
    expect(mapScopeToWechat("wechat_browser_oauth", "profile")).toBe("snsapi_userinfo");
    expect(mapScopeToWechat("desktop_qr", "profile")).toBe("snsapi_login");
  });

  it("creates QR auth URL", () => {
    configureWeb();
    const url = createAuthUrl({ state: "abc" });
    expect(url).toContain("https://open.weixin.qq.com/connect/qrconnect");
    expect(url).toContain("appid=wx_web");
    expect(url).toContain("scope=snsapi_login");
    expect(url).toContain("state=abc");
  });

  it("creates Official Account OAuth URL with fragment", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("MicroMessenger");
    configureWeb();
    const url = createAuthUrl({ scope: "base", state: "abc" });
    expect(url).toContain("connect/oauth2/authorize");
    expect(url).toContain("scope=snsapi_base");
    expect(url).toContain("#wechat_redirect");
  });

  it("generates state", () => {
    expect(generateState()).toHaveLength(32);
    expect(generateState()).not.toBe(generateState());
  });

  it("stores pending state during web authorize", async () => {
    configureWeb();
    vi.spyOn(window, "open").mockReturnValue(null);
    const result = await WeChatAuth.authorize({ state: "state-1" });
    expect(result.status).toBe("pending");
    expect(getPendingAuth()?.state).toBe("state-1");
  });

  it("does not navigate during authorize", async () => {
    configureWeb();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const result = await WeChatAuth.authorize({ state: "state-1" });
    expect(result.status).toBe("pending");
    expect(open).not.toHaveBeenCalled();
  });

  it("supports isolated client instances", async () => {
    const client = createWeChatAuth({
      web: { appId: "wx_web", redirectUri: "https://example.com/auth/wechat/callback" },
      stateStorageKey: "client-a",
    });
    const result = await client.authorize({ state: "state-1" });
    expect(result.status).toBe("pending");
    expect(WeChatAuth.isAvailable()).toBe(false);
  });

  it("exchanges successful auth during signIn", async () => {
    const client = createWeChatAuth(
      {
        native: { appId: "wx_native", redirectUri: "wechatdemo://wechat-auth/callback" },
        exchangeUrl: "/auth/wechat",
      },
      {
        nativeProvider: {
          isInstalled: async () => true,
          isAvailable: async () => true,
          authorize: async (input) => ({
            status: "success",
            code: "NATIVE_CODE",
            state: input.state,
            provider: "wechat_open_platform",
            flow: "native_app",
            scope: input.scope,
            redirectUri: input.redirectUri,
            environment: input.environment,
          }),
          handleOpenUrl: async () => null,
        },
      }
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "user_1" }, session: "session_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await client.signIn<{ user: { id: string }; session: string }>({
      state: "state-1",
      advanced: { forceFlow: "native_app" },
    });

    expect(result.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/wechat",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
    if (result.status === "success") {
      expect(result.session.session).toBe("session_1");
      expect(result.auth.code).toBe("NATIVE_CODE");
    }
  });

  it("supports a custom session exchange", async () => {
    const exchange = vi.fn<(input: WeChatSessionExchangeInput) => Promise<{ session: string }>>(
      async () => ({ session: "session_1" })
    );
    const client = createWeChatAuth(
      {
        native: { appId: "wx_native", redirectUri: "wechatdemo://wechat-auth/callback" },
      },
      {
        nativeProvider: {
          isInstalled: async () => true,
          isAvailable: async () => true,
          authorize: async (input) => ({
            status: "success",
            code: "NATIVE_CODE",
            state: input.state,
            provider: "wechat_open_platform",
            flow: "native_app",
            scope: input.scope,
            redirectUri: input.redirectUri,
            environment: input.environment,
          }),
          handleOpenUrl: async () => null,
        },
      }
    );

    const result = await client.signIn<{ session: string }>({
      state: "state-1",
      advanced: { forceFlow: "native_app" },
      exchange,
    });

    expect(exchange).toHaveBeenCalledWith({
      code: "NATIVE_CODE",
      state: "state-1",
      flow: "native_app",
      redirectUri: "wechatdemo://wechat-auth/callback",
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.session.session).toBe("session_1");
    }
  });

  it("obtains state, waits for the linking callback, and exchanges during signIn", async () => {
    configure({
      exchangeUrl: "/auth/wechat",
      web: { appId: "wx_web", redirectUri: "https://example.com/wechat-auth/callback" },
    });

    let linkingListener: ((event: { url: string }) => void) | undefined;
    const linking = {
      addEventListener: vi.fn<
        (_type: "url", listener: (event: { url: string }) => void) => { remove(): void }
      >((_type, listener) => {
        linkingListener = listener;
        return { remove: vi.fn<() => void>() };
      }),
      getInitialURL: vi.fn<() => Promise<null>>(async () => null),
      openURL: vi.fn<() => Promise<void>>(async () => {
        linkingListener?.({
          url: "https://example.com/wechat-auth/callback?code=WEB_CODE&state=server-state",
        });
      }),
    };
    setExpoLinkingModuleForTests(linking);
    WeChatAuth.installLinkingHandler();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "server-state" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: "session_1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const result = await WeChatAuth.signIn<{ session: string }>({ scope: "profile" });

    expect(result.status).toBe("success");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/auth/wechat/state");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/auth/wechat");
    expect(linking.openURL).toHaveBeenCalledTimes(1);
    if (result.status === "success") {
      expect(result.auth.code).toBe("WEB_CODE");
      expect(result.session.session).toBe("session_1");
    }
  });

  it("uses an injected native provider for native app auth", async () => {
    const client = createWeChatAuth(
      {
        native: { appId: "wx_native", redirectUri: "wechatdemo://wechat-auth/callback" },
        scheme: "wechatdemo",
      },
      {
        nativeProvider: {
          isInstalled: async () => true,
          isAvailable: async () => true,
          authorize: async (input) => ({
            status: "success",
            code: "NATIVE_CODE",
            state: input.state,
            provider: "wechat_open_platform",
            flow: "native_app",
            scope: input.scope,
            redirectUri: input.redirectUri,
            environment: input.environment,
          }),
          handleOpenUrl: async () => null,
        },
      }
    );
    const result = await client.authorize({
      state: "native-state",
      advanced: { forceFlow: "native_app" },
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.code).toBe("NATIVE_CODE");
      expect(result.flow).toBe("native_app");
    }
  });

  it("rejects a mismatched state from native authorization", async () => {
    const client = createWeChatAuth(
      {
        native: { appId: "wx_native", redirectUri: "wechatdemo://wechat-auth/callback" },
      },
      {
        nativeProvider: {
          isInstalled: async () => true,
          isAvailable: async () => true,
          authorize: async (input) => ({
            status: "success",
            code: "NATIVE_CODE",
            state: "wrong-state",
            provider: "wechat_open_platform",
            flow: "native_app",
            scope: input.scope,
            redirectUri: input.redirectUri,
            environment: input.environment,
          }),
          handleOpenUrl: async () => null,
        },
      }
    );

    const result = await client.authorize({
      state: "expected-state",
      advanced: { forceFlow: "native_app" },
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("INVALID_STATE");
    }
    expect(client.getPendingAuth()).toBeNull();
  });

  it("resumes the session exchange after a browser reload", async () => {
    configure({
      exchangeUrl: "/auth/wechat",
      stateTtlMs: 100,
      web: { appId: "wx_web", redirectUri: "https://example.com/wechat-auth/callback" },
    });
    const linking = {
      addEventListener: vi.fn<() => { remove(): void }>(() => ({
        remove: vi.fn<() => void>(),
      })),
      getInitialURL: vi.fn<() => Promise<null>>(async () => null),
      openURL: vi.fn<() => Promise<undefined>>(async () => undefined),
    };
    setExpoLinkingModuleForTests(linking);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "server-state" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: "session-after-reload" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const interruptedSignIn = WeChatAuth.signIn<{ session: string }>();
    await vi.waitFor(() => expect(linking.openURL).toHaveBeenCalledOnce());
    expect(getPendingAuth()?.exchangeUrl).toBe("/auth/wechat");

    clearListenersForTests();
    const callback = await handleRedirectCallback(
      "https://example.com/wechat-auth/callback?code=WEB_CODE&state=server-state"
    );
    expect(callback.status).toBe("success");
    if (callback.status === "success") {
      expect(callback.session).toEqual({ session: "session-after-reload" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(interruptedSignIn).resolves.toMatchObject({ status: "error" });
  });

  it("parses redirect callback and clears pending auth", async () => {
    configureWeb();
    vi.spyOn(window, "open").mockReturnValue(null);
    await WeChatAuth.authorize({ state: "state-1" });
    const result = await handleRedirectCallback(
      "https://example.com/auth/wechat/callback?code=CODE&state=state-1"
    );
    expect(result.status).toBe("success");
    expect(getPendingAuth()).toBeNull();
  });

  it("parses native callback URLs through the native provider and validates pending state", async () => {
    const client = createWeChatAuth(
      {
        web: { appId: "wx_web", redirectUri: "https://example.com/auth/wechat/callback" },
      },
      {
        nativeProvider: {
          isInstalled: async () => true,
          isAvailable: async () => true,
          authorize: async (input) => ({
            status: "success",
            code: "IGNORED",
            state: input.state,
            provider: "wechat_open_platform",
            flow: "native_app",
            scope: input.scope,
            redirectUri: input.redirectUri,
            environment: input.environment,
          }),
          handleOpenUrl: async (url) => ({
            status: "success",
            code: "CALLBACK_CODE",
            state: new URL(url).searchParams.get("state") || "",
            provider: "wechat_open_platform",
            flow: "native_app",
            scope: "profile",
            redirectUri: "wechatdemo://wechat-auth/callback",
            environment: detectEnvironment(),
          }),
        },
      }
    );
    await client.authorize({ state: "native-state" });
    const result = await client.handleRedirectCallback(
      "wechatdemo://wechat-auth/callback?state=native-state"
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.code).toBe("CALLBACK_CODE");
    }
  });

  it("rejects invalid state", async () => {
    configureWeb();
    vi.spyOn(window, "open").mockReturnValue(null);
    await WeChatAuth.authorize({ state: "state-1" });
    const result = await handleRedirectCallback(
      "https://example.com/auth/wechat/callback?code=CODE&state=wrong"
    );
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("INVALID_STATE");
    }
  });

  it("rejects callbacks without stored state by default", async () => {
    configureWeb();
    const result = await handleRedirectCallback(
      "https://example.com/auth/wechat/callback?code=CODE&state=state-1"
    );
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("MISSING_STATE");
    }
  });

  it("can parse callbacks without stored state when explicitly configured", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("MicroMessenger");
    configure({
      requireStoredState: false,
      web: { appId: "wx_web", redirectUri: "https://example.com/auth/wechat/callback" },
      officialAccount: {
        appId: "wx_mp",
        redirectUri: "https://example.com/auth/wechat/callback",
      },
    });
    const result = await handleRedirectCallback(
      "https://example.com/auth/wechat/callback?code=CODE&state=external-state"
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.state).toBe("external-state");
      expect(result.flow).toBe("wechat_browser_oauth");
      expect(result.provider).toBe("wechat_official_account");
    }
  });

  it("rejects expired pending state and clears it", async () => {
    configure({
      web: {
        appId: "wx_web",
        redirectUri: "https://example.com/auth/wechat/callback",
      },
      officialAccount: {
        appId: "wx_mp",
        redirectUri: "https://example.com/auth/wechat/callback",
      },
      stateTtlMs: 1,
    });
    vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1005);
    await WeChatAuth.authorize({ state: "state-1" });
    const result = await handleRedirectCallback(
      "https://example.com/auth/wechat/callback?code=CODE&state=state-1"
    );
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("STATE_EXPIRED");
    }
    expect(getPendingAuth()).toBeNull();
  });

  it("cleans up auth listeners", async () => {
    configureWeb();
    const listener = vi.fn<() => void>();
    const cleanup = addAuthListener(listener);
    cleanup();
    await WeChatAuth.authorize({ state: "state-1" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("installs one Expo Linking handler and returns cleanup", async () => {
    configure({
      requireStoredState: false,
      web: { appId: "wx_web", redirectUri: "https://example.com/auth/wechat/callback" },
    });

    let listener: ((event: { url: string }) => void) | undefined;
    const remove = vi.fn<() => void>();
    const linking = {
      addEventListener: vi.fn<
        (_type: "url", nextListener: (event: { url: string }) => void) => { remove(): void }
      >((_type, nextListener) => {
        listener = nextListener;
        return { remove };
      }),
      getInitialURL: vi.fn<() => Promise<string | null>>(
        async () => "https://example.com/auth/wechat/callback?code=INIT"
      ),
    };
    setExpoLinkingModuleForTests(linking);
    const authListener = vi.fn<Parameters<typeof addAuthListener>[0]>();
    addAuthListener(authListener);

    const uninstall = WeChatAuth.installLinkingHandler();
    const uninstallAgain = WeChatAuth.installLinkingHandler();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uninstallAgain).toBe(uninstall);
    expect(linking.addEventListener).toHaveBeenCalledTimes(1);
    expect(authListener).toHaveBeenCalledTimes(1);

    listener?.({ url: "https://example.com/auth/wechat/callback?code=EVENT" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(authListener).toHaveBeenCalledTimes(2);

    uninstall();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("handles the current browser URL when the page reloads on the callback", async () => {
    configureWeb();
    await WeChatAuth.authorize({ state: "browser-state" });
    window.history.replaceState(
      {},
      "",
      "/auth/wechat/callback?code=BROWSER_CODE&state=browser-state"
    );
    const authListener = vi.fn<Parameters<typeof addAuthListener>[0]>();
    addAuthListener(authListener);

    const uninstall = WeChatAuth.installLinkingHandler();
    await vi.waitFor(() => expect(authListener).toHaveBeenCalledOnce());

    expect(authListener).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", code: "BROWSER_CODE" })
    );
    uninstall();
    window.history.replaceState({}, "", "/");
  });

  it("hook exposes authorize state", async () => {
    configureWeb();
    const { result } = renderHook(() => useWeChatAuth(), {
      wrapper: ({ children }) => <>{children}</>,
    });
    await act(async () => {
      const authResult = await result.current.authorize({ state: "state-1" });
      expect(authResult.status).toBe("pending");
    });
    expect(result.current.loading).toBe(false);
  });
});
