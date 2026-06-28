// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("SSR import", () => {
  it("loads the browser entry without browser globals", async () => {
    const entry = await import("../index.js");
    expect(entry.createWeChatAuth).toBeTypeOf("function");
    const client = entry.createWeChatAuth(
      { web: { appId: "x", redirectUri: "https://example.com/callback" } },
      { generateState: () => "s" }
    );
    expect(client.detectEnvironment().platform).toBe("unknown");
  });
});
