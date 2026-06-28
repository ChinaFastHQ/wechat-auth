import { createAuthorizationUrl } from "@chinafast/wechat-auth-core";
import { getConfig } from "./config.js";
import { resolveFlow } from "./flow.js";
import type { WeChatAuthConfig, WeChatAuthorizeInput } from "./types.js";

export function createAuthUrl(
  input: WeChatAuthorizeInput = {},
  config: WeChatAuthConfig | undefined = getConfig()
): string | null {
  const resolved = resolveFlow(input, config);
  return createAuthorizationUrl(resolved, config!, input);
}
