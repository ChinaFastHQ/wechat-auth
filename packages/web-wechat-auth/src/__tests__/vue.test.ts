import { computed, ref } from "vue";
import { describe, expect, it } from "vitest";
import { createWeChatAuth } from "../index.js";

describe("Vue consumer", () => {
  it("adapts the vanilla client without implementing an auth flow", async () => {
    const client = createWeChatAuth(
      { web: { appId: "wx-web", redirectUri: "https://example.com/callback" } },
      { userAgent: () => "Desktop Chrome", generateState: () => "state" }
    );
    const pending = ref(client.getPendingAuth());
    const hasPendingAuth = computed(() => pending.value !== null);
    await client.authorize();
    pending.value = client.getPendingAuth();
    expect(hasPendingAuth.value).toBe(true);
  });
});
