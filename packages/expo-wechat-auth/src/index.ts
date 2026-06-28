import { WeChatAuth as WeChatAuthClient } from "./core.js";

export {
  WeChatAuth,
  authorize,
  configure,
  createWeChatAuth,
  installLinkingHandler,
  signIn,
  signInWithRedirect,
  handleRedirectCallback,
  isAvailable,
} from "./core.js";
export { createAuthUrl } from "./url.js";
export type * from "./types.js";
export type { CreateWeChatAuthOptions, WeChatAuthClient } from "./core.js";

/** Detects the current environment using the active WeChatAuth configuration. */
export const detectEnvironment = WeChatAuthClient.detectEnvironment;
