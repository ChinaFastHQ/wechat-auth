import { describe, expect, it } from "vitest";

import {
  browserFromUserAgent,
  createSerializedPendingAuthStorage,
  deviceFromUserAgent,
  encodeBase64Url,
  isWeChatPendingAuth,
} from "../index.js";

describe("portable runtime classification", () => {
  it("classifies browser and device user agents", () => {
    expect(browserFromUserAgent("Mozilla iPhone MicroMessenger")).toBe("wechat");
    expect(browserFromUserAgent("Mozilla Chrome/120")).toBe("chrome");
    expect(deviceFromUserAgent("Mozilla iPhone Safari", true)).toBe("mobile");
    expect(deviceFromUserAgent("Desktop Chrome", true)).toBe("desktop");
    expect(deviceFromUserAgent("", false)).toBe("unknown");
  });

  it("validates complete pending-auth records", () => {
    expect(
      isWeChatPendingAuth({
        provider: "wechat_open_platform",
        flow: "desktop_qr",
        scope: "profile",
        state: "state",
        redirectUri: "https://example.com/callback",
        createdAt: 1,
      })
    ).toBe(true);
    expect(
      isWeChatPendingAuth({
        state: "state",
        redirectUri: "https://example.com/callback",
        createdAt: 1,
      })
    ).toBe(false);
  });

  it("shares serialized storage and base64url behavior without runtime globals", () => {
    const values = new Map<string, string>();
    const storage = createSerializedPendingAuthStorage("pending", () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => void values.delete(key),
    }));
    const pending = {
      provider: "wechat_open_platform" as const,
      flow: "desktop_qr" as const,
      scope: "profile" as const,
      state: "state",
      redirectUri: "https://example.com/callback",
      createdAt: 1,
    };

    storage.set(pending);
    expect(storage.get()).toEqual(pending);
    expect(encodeBase64Url(new Uint8Array([251, 255]), () => "+/8=")).toBe("-_8");
  });
});
