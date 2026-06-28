import { encodeBase64Url } from "@chinafast/wechat-auth-core";

const STATE_BYTES = 24;

export function generateState(): string {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error(
      "Secure random state generation is unavailable in this runtime. Provide an explicit state or install a crypto polyfill."
    );
  }
  const bytes = crypto.getRandomValues(new Uint8Array(STATE_BYTES));
  return encodeBase64Url(bytes, btoa);
}
