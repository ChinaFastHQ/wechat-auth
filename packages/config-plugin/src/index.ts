import type { ConfigPlugin } from "@expo/config-plugins";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
} from "@expo/config-plugins";

export type ExpoWeChatAuthPluginOptions = {
  wechat?: {
    appId?: string;
    universalLink?: string;
    androidPackageName?: string;
    iosBundleIdentifier?: string;
  };
  scheme?: string;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasUrlScheme(entry: { CFBundleURLSchemes?: string[] }, scheme: string): boolean {
  return Boolean(entry.CFBundleURLSchemes?.includes(scheme));
}

const withWeChatInfoPlist: ConfigPlugin<ExpoWeChatAuthPluginOptions> = (config, options) =>
  withInfoPlist(config, (next) => {
    const appId = options.wechat?.appId;
    const scheme = options.scheme;
    const existingSchemes = next.modResults.CFBundleURLTypes || [];
    const schemes = unique([appId || "", scheme || ""]);
    if (
      schemes.length > 0 &&
      !schemes.every((value) => existingSchemes.some((entry) => hasUrlScheme(entry, value)))
    ) {
      next.modResults.CFBundleURLTypes = [
        ...existingSchemes,
        {
          CFBundleURLName: options.wechat?.iosBundleIdentifier || "expo-wechat-auth",
          CFBundleURLSchemes: schemes,
        },
      ];
    }

    const queries = new Set<string>(next.modResults.LSApplicationQueriesSchemes || []);
    ["weixin", "weixinULAPI", "weixinURLParamsAPI"].forEach((value) => queries.add(value));
    next.modResults.LSApplicationQueriesSchemes = Array.from(queries);

    return next;
  });

export function associatedDomain(universalLink?: string): string | undefined {
  if (!universalLink) {
    return undefined;
  }
  try {
    const url = new URL(universalLink);
    return url.protocol === "https:" && url.host ? `applinks:${url.host}` : undefined;
  } catch {
    return undefined;
  }
}

export function androidEntryActivitySource(packageName: string): string {
  return `package ${packageName}.wxapi;

import android.app.Activity;
import android.os.Bundle;
import expo.modules.wechatauth.ExpoWeChatAuthModule;

public class WXEntryActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    ExpoWeChatAuthModule.handleIntent(getIntent());
    finish();
  }
}
`;
}

const withWeChatEntitlements: ConfigPlugin<ExpoWeChatAuthPluginOptions> = (config, options) =>
  withEntitlementsPlist(config, (next) => {
    const domain = associatedDomain(options.wechat?.universalLink);
    if (!domain) {
      return next;
    }
    const domains = new Set<string>(
      (next.modResults["com.apple.developer.associated-domains"] as string[] | undefined) || []
    );
    domains.add(domain);
    next.modResults["com.apple.developer.associated-domains"] = Array.from(domains);
    return next;
  });

const withWeChatAndroidManifest: ConfigPlugin<ExpoWeChatAuthPluginOptions> = (config, options) =>
  withAndroidManifest(config, (next) => {
    const manifest = next.modResults.manifest;
    const scheme = options.scheme || options.wechat?.appId;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(next.modResults);
    mainApplication.activity = mainApplication.activity || [];
    const mainActivity =
      mainApplication.activity.find(
        (activity) => activity.$?.["android:name"] === ".MainActivity"
      ) || mainApplication.activity[0];

    if (mainActivity && scheme) {
      mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];
      const hasScheme = mainActivity["intent-filter"].some((filter) =>
        filter.data?.some((data) => data.$?.["android:scheme"] === scheme)
      );
      if (!hasScheme) {
        mainActivity["intent-filter"].push({
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          category: [
            { $: { "android:name": "android.intent.category.DEFAULT" } },
            { $: { "android:name": "android.intent.category.BROWSABLE" } },
          ],
          data: [{ $: { "android:scheme": scheme } }],
        });
      }
    }

    const packageName = options.wechat?.androidPackageName || next.android?.package;
    if (packageName) {
      mainApplication.activity = mainApplication.activity || [];
      const entryActivityName = `${packageName}.wxapi.WXEntryActivity`;
      if (
        !mainApplication.activity.some(
          (activity) => activity.$?.["android:name"] === entryActivityName
        )
      ) {
        mainApplication.activity.push({
          $: {
            "android:name": entryActivityName,
            "android:exported": "true",
            "android:launchMode": "singleTask",
            "android:taskAffinity": packageName,
          },
        });
      }
    }

    manifest.queries = manifest.queries || [];
    const hasWeChatQuery = manifest.queries.some((query) =>
      query.package?.some((entry) => entry.$?.["android:name"] === "com.tencent.mm")
    );
    if (!hasWeChatQuery) {
      manifest.queries.push({
        package: [{ $: { "android:name": "com.tencent.mm" } }],
      });
    }

    return next;
  });

const withWeChatAndroidEntryActivity: ConfigPlugin<ExpoWeChatAuthPluginOptions> = (
  config,
  options
) =>
  withDangerousMod(config, [
    "android",
    async (next) => {
      const packageName = options.wechat?.androidPackageName || next.android?.package;
      if (!packageName) {
        return next;
      }
      const directory = path.join(
        next.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...packageName.split("."),
        "wxapi"
      );
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "WXEntryActivity.java"),
        androidEntryActivitySource(packageName),
        "utf8"
      );
      return next;
    },
  ]);

export const withExpoWeChatAuth: ConfigPlugin<ExpoWeChatAuthPluginOptions> = (
  config,
  options = {}
) => {
  let next = config;
  if (options.scheme) {
    next.scheme = options.scheme;
  }
  if (options.wechat?.androidPackageName) {
    next.android = { ...next.android, package: options.wechat.androidPackageName };
  }
  if (options.wechat?.iosBundleIdentifier) {
    next.ios = { ...next.ios, bundleIdentifier: options.wechat.iosBundleIdentifier };
  }
  next = withWeChatInfoPlist(next, options);
  next = withWeChatEntitlements(next, options);
  next = withWeChatAndroidManifest(next, options);
  next = withWeChatAndroidEntryActivity(next, options);
  return next;
};

export default createRunOncePlugin(withExpoWeChatAuth, "@chinafast/expo-wechat-auth", "0.1.0");
