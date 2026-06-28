import { describe, expect, it } from "vitest";
import { compileModsAsync } from "@expo/config-plugins";

import { androidEntryActivitySource, associatedDomain, withExpoWeChatAuth } from "./index";

describe("expo-wechat-auth config plugin", () => {
  it("configures native application identifiers", () => {
    const config = withExpoWeChatAuth(
      { name: "Example", slug: "example" },
      {
        scheme: "example",
        wechat: {
          appId: "wx-app",
          androidPackageName: "com.example.app",
          iosBundleIdentifier: "com.example.app",
        },
      }
    );

    expect(config.scheme).toBe("example");
    expect(config.android?.package).toBe("com.example.app");
    expect(config.ios?.bundleIdentifier).toBe("com.example.app");
    expect(config.mods?.android?.manifest).toBeTypeOf("function");
    expect(config.mods?.android?.dangerous).toBeTypeOf("function");
    expect(config.mods?.ios?.infoPlist).toBeTypeOf("function");
    expect(config.mods?.ios?.entitlements).toBeTypeOf("function");
  });

  it("derives a valid Associated Domains entitlement", () => {
    expect(associatedDomain("https://auth.example.com/wechat/")).toBe("applinks:auth.example.com");
    expect(associatedDomain("http://auth.example.com/wechat/")).toBeUndefined();
    expect(associatedDomain("not a url")).toBeUndefined();
  });

  it("generates the Android SDK callback activity", () => {
    const source = androidEntryActivitySource("com.example.app");
    expect(source).toContain("package com.example.app.wxapi;");
    expect(source).toContain("ExpoWeChatAuthModule.handleIntent(getIntent());");
  });

  it("writes the native callback and universal-link configuration", async () => {
    const configured = withExpoWeChatAuth(
      { name: "Example", slug: "example" },
      {
        scheme: "example",
        wechat: {
          appId: "wx-app",
          universalLink: "https://auth.example.com/wechat/",
          androidPackageName: "com.example.app",
          iosBundleIdentifier: "com.example.app",
        },
      }
    );
    const compiled = await compileModsAsync(configured, {
      projectRoot: process.cwd(),
      platforms: ["ios", "android"],
      introspect: true,
      ignoreExistingNativeFiles: true,
    });
    const internal = Reflect.get(compiled, "_internal") as { modResults: unknown };
    const results = internal.modResults as {
      ios: { infoPlist: Record<string, unknown>; entitlements: Record<string, unknown> };
      android: { manifest: { manifest: { application: Array<{ activity?: unknown[] }> } } };
    };

    expect(results.ios.infoPlist.CFBundleURLTypes).toEqual([
      {
        CFBundleURLName: "com.example.app",
        CFBundleURLSchemes: ["wx-app", "example"],
      },
    ]);
    expect(results.ios.entitlements["com.apple.developer.associated-domains"]).toEqual([
      "applinks:auth.example.com",
    ]);
    expect(results.android.manifest.manifest.application[0]?.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $: expect.objectContaining({
            "android:name": "com.example.app.wxapi.WXEntryActivity",
          }),
        }),
      ])
    );
  });
});
