import {
  createSerializedPendingAuthStorage,
  type PendingAuthStorage,
  type WeChatPendingAuth,
} from "@chinafast/wechat-auth-core";

const DEFAULT_KEY = "expo-wechat-auth.pending";
const stores = new Map<string, PendingAuthStorage>();

function browserStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function getStorageKey(key?: string): string {
  return key || DEFAULT_KEY;
}

export function createExpoPendingAuthStorage(key?: string): PendingAuthStorage {
  const storageKey = getStorageKey(key);
  const existing = stores.get(storageKey);
  if (existing) {
    return existing;
  }
  const store = createSerializedPendingAuthStorage(storageKey, browserStorage);
  stores.set(storageKey, store);
  return store;
}

export function setPendingAuth(value: WeChatPendingAuth, key?: string): void {
  createExpoPendingAuthStorage(key).set(value);
}

export function getPendingAuth(key?: string): WeChatPendingAuth | null {
  return createExpoPendingAuthStorage(key).get();
}

export function clearPendingAuth(key?: string): void {
  createExpoPendingAuthStorage(key).clear();
}
