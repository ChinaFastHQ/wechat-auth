import type {
  WeChatAuthError,
  WeChatAuthErrorCode,
  WeChatAuthFlow,
  WeChatAuthProvider,
} from "./types.js";

export class WeChatAuthException extends Error {
  readonly authError: WeChatAuthError;
  constructor(error: WeChatAuthError) {
    super(error.message);
    this.name = "WeChatAuthException";
    this.authError = error;
  }
}

export function createError(
  code: WeChatAuthErrorCode,
  message: string,
  details: { provider?: WeChatAuthProvider; flow?: WeChatAuthFlow; cause?: unknown } = {}
): WeChatAuthError {
  return { code, message, ...details };
}

export function failed(error: WeChatAuthError) {
  return { status: "failed" as const, error };
}
