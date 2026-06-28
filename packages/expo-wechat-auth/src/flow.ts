import { mapScopeToWechat, resolveFlow as resolveCoreFlow } from "@chinafast/wechat-auth-core";
import { getConfig } from "./config.js";
import { detectEnvironment } from "./environment.js";
import { createError, WeChatAuthException } from "./errors.js";
import type { WeChatAuthConfig, WeChatAuthorizeInput } from "./types.js";

export { mapScopeToWechat };

export function resolveFlow(
  input: WeChatAuthorizeInput = {},
  config: WeChatAuthConfig | undefined = getConfig()
) {
  if (!config) {
    throw new WeChatAuthException(
      createError("NOT_CONFIGURED", "Call configure() before resolving a WeChat auth flow.")
    );
  }
  return resolveCoreFlow(input, config, detectEnvironment(config));
}
