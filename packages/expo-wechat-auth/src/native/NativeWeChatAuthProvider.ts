import type { WeChatAuthCodeResult, WeChatAuthEnvironment, WeChatAuthScope } from "../types.js";

export type NativeAuthorizeInput = {
  scope: WeChatAuthScope;
  state: string;
  appId: string;
  universalLink?: string;
  redirectUri: string;
  environment: WeChatAuthEnvironment;
};

export interface NativeWeChatAuthProvider {
  isInstalled(): Promise<boolean>;
  isAvailable(): Promise<boolean>;
  authorize(input: NativeAuthorizeInput): Promise<WeChatAuthCodeResult>;
  handleOpenUrl(url: string): Promise<WeChatAuthCodeResult | null>;
}

type NativeModuleAuthResult = {
  code?: string;
  state?: string;
  errCode?: number;
  errStr?: string;
  errorCode?: number;
  errorMessage?: string;
  cancelled?: boolean;
  raw?: unknown;
};

type NativeWeChatAuthModule = {
  isInstalled?: () => Promise<boolean> | boolean;
  isAvailable?: () => Promise<boolean> | boolean;
  authorize?: (
    input: NativeAuthorizeInput & { wechatScope: string }
  ) => Promise<NativeModuleAuthResult>;
  handleOpenUrl?: (url: string) => Promise<NativeModuleAuthResult | null>;
};

async function getReactNativeModule(): Promise<NativeWeChatAuthModule | undefined> {
  try {
    const { requireNativeModule } = await import("expo");
    return requireNativeModule<NativeWeChatAuthModule>("ExpoWeChatAuth");
  } catch {
    return undefined;
  }
}

function scopeToNative(scope: WeChatAuthScope): string {
  return scope === "base" ? "snsapi_base" : "snsapi_userinfo";
}

function assertSuccessfulNativeResult(
  result: NativeModuleAuthResult,
  input: NativeAuthorizeInput
): WeChatAuthCodeResult {
  const errorCode = result.errCode ?? result.errorCode;
  if (result.cancelled || errorCode === -2) {
    throw new Error(result.errStr || result.errorMessage || "WeChat authorization was cancelled.");
  }
  if (errorCode && errorCode !== 0) {
    throw new Error(
      result.errStr || result.errorMessage || `WeChat authorization failed with code ${errorCode}.`
    );
  }
  if (!result.code) {
    throw new Error("WeChat native authorization did not return an authorization code.");
  }
  if (!result.state) {
    throw new Error("WeChat native authorization did not return OAuth state.");
  }

  return {
    status: "success",
    code: result.code,
    state: result.state,
    provider: "wechat_open_platform",
    flow: "native_app",
    scope: input.scope,
    redirectUri: input.redirectUri,
    environment: input.environment,
    raw: result.raw ?? result,
  };
}

export class ReactNativeModuleWeChatAuthProvider implements NativeWeChatAuthProvider {
  constructor(
    private readonly getModule: () =>
      | NativeWeChatAuthModule
      | undefined
      | Promise<NativeWeChatAuthModule | undefined> = getReactNativeModule
  ) {}

  async isInstalled(): Promise<boolean> {
    const module = await this.getModule();
    if (!module?.isInstalled) {
      return false;
    }
    return Boolean(await module.isInstalled());
  }

  async isAvailable(): Promise<boolean> {
    const module = await this.getModule();
    if (!module?.authorize) {
      return false;
    }
    if (module.isAvailable) {
      return Boolean(await module.isAvailable());
    }
    if (module.isInstalled) {
      return Boolean(await module.isInstalled());
    }
    return true;
  }

  async authorize(input: NativeAuthorizeInput): Promise<WeChatAuthCodeResult> {
    const module = await this.getModule();
    if (!module?.authorize) {
      throw new Error("The bundled WeChat native bridge is unavailable.");
    }
    const result = await module.authorize({ ...input, wechatScope: scopeToNative(input.scope) });
    return assertSuccessfulNativeResult(result, input);
  }

  async handleOpenUrl(url: string): Promise<WeChatAuthCodeResult | null> {
    const module = await this.getModule();
    if (!module?.handleOpenUrl) {
      return null;
    }
    const result = await module.handleOpenUrl(url);
    if (!result) {
      return null;
    }
    return assertSuccessfulNativeResult(result, {
      scope: "profile",
      state: result.state || "",
      appId: "",
      redirectUri: url,
      environment: {
        platform: "unknown",
        device: "unknown",
        browser: "unknown",
        runtime: "unknown",
        supports: {
          nativeWeChatSdk: true,
          deepLink: true,
          universalLink: false,
          qrLogin: false,
          officialAccountOAuth: false,
          webRedirect: false,
        },
      },
    });
  }
}

export class MissingNativeWeChatAuthProvider implements NativeWeChatAuthProvider {
  async isInstalled(): Promise<boolean> {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async authorize(): Promise<WeChatAuthCodeResult> {
    throw new Error(
      "The WeChat native bridge is unavailable. Install a dev client or EAS build that includes the native SDK."
    );
  }

  async handleOpenUrl(): Promise<WeChatAuthCodeResult | null> {
    return null;
  }
}
