import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWeChatAuth, type WeChatAuthClient } from "../index.js";
import { useWeChatAuth, useWeChatRedirectCallback } from "../react.js";

const strictWrapper = ({ children }: { children: React.ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);

function client(): WeChatAuthClient {
  return createWeChatAuth(
    { web: { appId: "x", redirectUri: "https://example.com/callback" } },
    { userAgent: () => "Desktop", generateState: () => "s", navigate: async () => {} }
  );
}
describe("React hooks", () => {
  it("reports pending auth and loading", async () => {
    const value = client();
    const hook = renderHook(() => useWeChatAuth(value));
    await act(async () => {
      await hook.result.current.authorize();
    });
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.pendingAuth?.state).toBe("s");
  });
  it("reports client errors", async () => {
    const value = client();
    vi.spyOn(value, "authorize").mockResolvedValue({
      status: "failed",
      error: { code: "AUTH_FAILED", message: "denied" },
    });
    const hook = renderHook(() => useWeChatAuth(value));
    await act(async () => {
      await hook.result.current.authorize();
    });
    expect(hook.result.current.error).toMatchObject({ code: "AUTH_FAILED", message: "denied" });
  });
  it("does not update an unmounted hook", async () => {
    let finish!: () => void;
    const value = client();
    vi.spyOn(value, "authorize").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ status: "cancelled" });
        })
    );
    const hook = renderHook(() => useWeChatAuth(value));
    const pending = hook.result.current.authorize();
    hook.unmount();
    finish();
    await expect(pending).resolves.toEqual({ status: "cancelled" });
  });
  it("deduplicates callback handling in Strict Mode", async () => {
    const value = client();
    await value.authorize({ state: "s" });
    const callback = vi.spyOn(value, "handleRedirectCallback");
    const hook = renderHook(
      () => useWeChatRedirectCallback(value, "https://example.com/callback?code=C&state=s"),
      { wrapper: strictWrapper }
    );
    await vi.waitFor(() => expect(hook.result.current?.status).toBe("success"));
    expect(callback).toHaveBeenCalledOnce();
  });
  it("keeps loading true until concurrent operations settle", async () => {
    const value = client();
    let first!: () => void;
    let second!: () => void;
    vi.spyOn(value, "authorize")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = () => resolve({ status: "cancelled" });
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            second = () => resolve({ status: "cancelled" });
          })
      );
    const hook = renderHook(() => useWeChatAuth(value));
    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = hook.result.current.authorize();
      b = hook.result.current.authorize();
    });
    await act(async () => {
      first();
      await a;
    });
    expect(hook.result.current.loading).toBe(true);
    await act(async () => {
      second();
      await b;
    });
    expect(hook.result.current.loading).toBe(false);
  });
});
