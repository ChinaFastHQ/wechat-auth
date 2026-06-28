import type { WeChatAuthEnvironment } from "./types.js";

/** Classifies a browser from a user-agent string without reading runtime globals. */
export function browserFromUserAgent(userAgent: string): WeChatAuthEnvironment["browser"] {
  const value = userAgent.toLowerCase();
  if (/micromessenger/.test(value)) {
    return "wechat";
  }
  if (/alipayclient/.test(value)) {
    return "alipay";
  }
  if (/\bwv\b|webview/.test(value)) {
    return "webview";
  }
  if (/edg\//.test(value)) {
    return "edge";
  }
  if (/firefox\//.test(value)) {
    return "firefox";
  }
  if (/chrome|crios/.test(value)) {
    return "chrome";
  }
  if (/safari/.test(value)) {
    return "safari";
  }
  return "unknown";
}

/** Classifies a device from a user-agent string without reading runtime globals. */
export function deviceFromUserAgent(
  userAgent: string,
  browserPresent: boolean
): WeChatAuthEnvironment["device"] {
  const value = userAgent.toLowerCase();
  if (/ipad|tablet/.test(value)) {
    return "tablet";
  }
  if (/iphone|android.+mobile|mobile/.test(value)) {
    return "mobile";
  }
  return browserPresent ? "desktop" : "unknown";
}
