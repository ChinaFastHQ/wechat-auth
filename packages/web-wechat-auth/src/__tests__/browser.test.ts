import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserPendingAuthStorage, createWeChatAuth } from "../index.js";

const config = {
  web: { appId: "wx-web", redirectUri: "https://example.com/callback" },
  officialAccount: { appId: "wx-mp", redirectUri: "https://example.com/callback" },
};
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("browser client", () => {
  it("uses sessionStorage by default and localStorage when requested", async () => {
    const sessionClient = createWeChatAuth(config, {
      userAgent: () => "Desktop Chrome",
      generateState: () => "session-state",
    });
    await sessionClient.authorize();
    expect(sessionStorage.getItem("web-wechat-auth.pending")).toContain("session-state");
    const local = createBrowserPendingAuthStorage("local", "local-key");
    const localClient = createWeChatAuth(config, {
      storage: local,
      userAgent: () => "Desktop Chrome",
      generateState: () => "local-state",
    });
    await localClient.authorize();
    expect(localStorage.getItem("local-key")).toContain("local-state");
  });
  it("selects Official Account OAuth inside WeChat", () => {
    const client = createWeChatAuth(config, { userAgent: () => "iPhone MicroMessenger" });
    expect(client.resolveFlow().flow).toBe("wechat_browser_oauth");
    expect(client.createAuthUrl()).toContain("#wechat_redirect");
  });
  it("returns a clear failure in external mobile browsers", async () => {
    const client = createWeChatAuth(config, { userAgent: () => "iPhone Safari" });
    const result = await client.authorize({ state: "s" });
    expect(result).toMatchObject({ status: "failed", error: { code: "UNSUPPORTED_ENVIRONMENT" } });
  });
  it("rejects missing, mismatched, expired, replayed, and malformed browser state", async () => {
    const create = (clock = () => 1) =>
      createWeChatAuth(
        { ...config, stateTtlMs: 5 },
        { userAgent: () => "Desktop Chrome", generateState: () => "right", clock }
      );
    expect(
      await create().handleRedirectCallback("https://example.com/callback?code=CODE&state=right")
    ).toMatchObject({ status: "failed", error: { code: "MISSING_STATE" } });
    const mismatched = create();
    await mismatched.authorize();
    expect(
      await mismatched.handleRedirectCallback("https://example.com/callback?code=CODE&state=wrong")
    ).toMatchObject({ status: "failed", error: { code: "INVALID_STATE" } });
    let time = 1;
    const expired = create(() => time);
    await expired.authorize();
    time = 7;
    expect(
      await expired.handleRedirectCallback("https://example.com/callback?code=CODE&state=right")
    ).toMatchObject({ status: "failed", error: { code: "STATE_EXPIRED" } });
    const replayed = create();
    await replayed.authorize();
    const callback = "https://example.com/callback?code=CODE&state=right";
    expect((await replayed.handleRedirectCallback(callback)).status).toBe("success");
    expect(await replayed.handleRedirectCallback(callback)).toMatchObject({
      status: "failed",
      error: { code: "MISSING_STATE" },
    });
    sessionStorage.setItem("web-wechat-auth.pending", "{bad-json");
    expect(create().getPendingAuth()).toBeNull();
    expect(sessionStorage.getItem("web-wechat-auth.pending")).toBeNull();
  });
  it("supports injected navigation, clock, randomness, fetch, and custom exchange", async () => {
    let client: ReturnType<typeof createWeChatAuth>;
    const exchange = vi.fn<() => Promise<{ session: string }>>(async () => ({ session: "ok" }));
    const navigate = vi.fn<(url: string) => Promise<void>>(async () => {
      await client.handleRedirectCallback(
        "https://example.com/callback?code=CODE&state=server-state"
      );
    });
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ state: "server-state" }), { status: 200 })
    );
    client = createWeChatAuth(config, {
      userAgent: () => "Desktop Chrome",
      navigate,
      clock: () => 10,
      generateState: () => "random",
      fetch: fetcher,
    });
    const result = await client.signIn<{ session: string }>({ exchange });
    expect(result.status).toBe("success");
    expect(navigate).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(exchange).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CODE", state: "server-state" })
    );
  });
});
