import { describe, expect, it, vi } from "vitest";
import {
  createMemoryPendingAuthStorage,
  createWeChatAuth,
  type WeChatAuthEnvironment,
  type WeChatAuthListener,
  type WeChatPendingAuth,
} from "../index.js";

const desktop: WeChatAuthEnvironment = {
  platform: "web",
  device: "desktop",
  browser: "chrome",
  runtime: "web",
  supports: {
    nativeWeChatSdk: false,
    deepLink: false,
    universalLink: false,
    qrLogin: true,
    officialAccountOAuth: false,
    webRedirect: true,
  },
};
const config = { web: { appId: "wx-web", redirectUri: "https://example.com/callback" } };

function setup(storage = createMemoryPendingAuthStorage(), now = () => 1000) {
  return createWeChatAuth(
    {
      storage,
      detectEnvironment: () => desktop,
      openUrl: async () => {},
      generateState: () => "generated",
      parseCallbackUrl: parse,
      now,
    },
    config
  );
}

function parse(url: string) {
  const value = new URL(url);
  return {
    code: value.searchParams.get("code"),
    state: value.searchParams.get("state") || "",
    error: value.searchParams.get("error") || value.searchParams.get("errcode"),
    redirectUri: value.origin + value.pathname,
  };
}

describe("portable client", () => {
  it("creates desktop URLs and stores pending state", async () => {
    const client = setup();
    const result = await client.authorize({ state: "state-1" });
    expect(result).toMatchObject({ status: "pending", flow: "desktop_qr", state: "state-1" });
    expect(result.status === "pending" && result.authUrl).toContain("appid=wx-web");
    expect(client.getPendingAuth()?.state).toBe("state-1");
  });
  it.each([
    ["missing", "https://example.com/callback?code=x&state=s", "MISSING_STATE"],
    ["mismatch", "https://example.com/callback?code=x&state=wrong", "INVALID_STATE"],
  ])("rejects %s state", async (_name, url, code) => {
    const client = setup();
    if (code === "INVALID_STATE") {
      await client.authorize({ state: "right" });
    }
    const result = await client.handleRedirectCallback(url);
    expect(result.status === "failed" && result.error.code).toBe(code);
    expect(client.getPendingAuth()).toBeNull();
  });
  it("rejects expired state and consumes it", async () => {
    let time = 1000;
    const client = createWeChatAuth(
      {
        storage: createMemoryPendingAuthStorage(),
        detectEnvironment: () => desktop,
        openUrl: async () => {},
        generateState: () => "s",
        parseCallbackUrl: parse,
        now: () => time,
      },
      { ...config, stateTtlMs: 5 }
    );
    await client.authorize({ state: "s" });
    time = 1006;
    const result = await client.handleRedirectCallback(
      "https://example.com/callback?code=x&state=s"
    );
    expect(result.status === "failed" && result.error.code).toBe("STATE_EXPIRED");
    expect(client.getPendingAuth()).toBeNull();
  });
  it("prevents callback replay", async () => {
    const client = setup();
    await client.authorize({ state: "s" });
    expect(
      (await client.handleRedirectCallback("https://example.com/callback?code=x&state=s")).status
    ).toBe("success");
    const replay = await client.handleRedirectCallback(
      "https://example.com/callback?code=x&state=s"
    );
    expect(replay.status === "failed" && replay.error.code).toBe("MISSING_STATE");
  });
  it("treats malformed storage as missing and clears it", async () => {
    const clear = vi.fn<() => void>();
    const client = setup({
      get: () => {
        throw new Error("malformed");
      },
      set: vi.fn<(pending: WeChatPendingAuth) => void>(),
      clear,
    });
    const result = await client.handleRedirectCallback(
      "https://example.com/callback?code=x&state=s"
    );
    expect(result.status === "failed" && result.error.code).toBe("MISSING_STATE");
    expect(clear).toHaveBeenCalled();
  });
  it("scopes listeners to each client", async () => {
    const a = setup();
    const b = setup();
    const listener = vi.fn<WeChatAuthListener>();
    b.addAuthListener(listener);
    await a.authorize({ state: "s" });
    await a.handleRedirectCallback("https://example.com/callback?code=x&state=s");
    expect(listener).not.toHaveBeenCalled();
  });
});
