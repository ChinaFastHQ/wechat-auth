import { describe, expect, it, vi } from "vitest";

import {
  createMemoryStateStore,
  credentialsForFlow,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  type WeChatServerCredentials,
  type WeChatTokenResponse,
} from "../index.js";

const credentials: WeChatServerCredentials = {
  openPlatform: { appId: "open-id", secret: "open-secret" },
  web: { appId: "web-id", secret: "web-secret" },
  officialAccount: { appId: "mp-id", secret: "mp-secret" },
};

describe("server helpers", () => {
  it("selects credentials for each flow", () => {
    expect(credentialsForFlow(credentials, "native_app")).toBe(credentials.openPlatform);
    expect(credentialsForFlow(credentials, "desktop_qr")).toBe(credentials.web);
    expect(credentialsForFlow(credentials, "wechat_browser_oauth")).toBe(
      credentials.officialAccount
    );
  });

  it("exchanges a code with the credentials matching the flow", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "token",
            expires_in: 7200,
            refresh_token: "refresh",
            openid: "openid",
            scope: "snsapi_login",
          }),
          { status: 200 }
        )
    );

    await exchangeWeChatCode(
      { code: "auth-code", flow: "desktop_qr" },
      { credentials, fetch: fetcher }
    );

    const url = fetcher.mock.calls[0]?.[0] as URL;
    expect(url.searchParams.get("appid")).toBe("web-id");
    expect(url.searchParams.get("secret")).toBe("web-secret");
    expect(url.searchParams.get("code")).toBe("auth-code");
  });

  it("does not request profile data without a profile scope", async () => {
    const token: WeChatTokenResponse = {
      access_token: "token",
      expires_in: 7200,
      refresh_token: "refresh",
      openid: "openid",
      unionid: "unionid",
      scope: "snsapi_base",
    };
    const fetcher = vi.fn<typeof fetch>();

    await expect(fetchWeChatUserInfo(token, { fetch: fetcher })).resolves.toEqual({
      openid: "openid",
      unionid: "unionid",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("consumes state exactly once", () => {
    const store = createMemoryStateStore();
    const pending = store.create();

    expect(store.consume(pending.state)).toEqual({ ok: true });
    expect(store.consume(pending.state)).toEqual({ ok: false, reason: "not_found" });
  });
});
