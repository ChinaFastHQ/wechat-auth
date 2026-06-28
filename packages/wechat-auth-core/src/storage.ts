import type { WeChatPendingAuth } from "./types.js";

export interface PendingAuthStorage {
  get(): WeChatPendingAuth | null;
  set(pending: WeChatPendingAuth): void;
  clear(): void;
}

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isWeChatPendingAuth(value: unknown): value is WeChatPendingAuth {
  if (!value || typeof value !== "object") {
    return false;
  }
  const pending = value as Record<string, unknown>;
  const provider =
    pending.provider === "wechat_open_platform" || pending.provider === "wechat_official_account";
  const flow =
    pending.flow === "native_app" ||
    pending.flow === "desktop_qr" ||
    pending.flow === "wechat_browser_oauth";
  const scope = pending.scope === "base" || pending.scope === "profile";
  const optionalString = (key: string) =>
    pending[key] === undefined || typeof pending[key] === "string";
  const metadata = pending.metadata;
  const validMetadata =
    metadata === undefined ||
    (metadata !== null &&
      typeof metadata === "object" &&
      Object.values(metadata).every(
        (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean"
      ));
  return (
    provider &&
    flow &&
    scope &&
    typeof pending.state === "string" &&
    typeof pending.createdAt === "number" &&
    typeof pending.redirectUri === "string" &&
    optionalString("authUrl") &&
    optionalString("returnTo") &&
    optionalString("exchangeUrl") &&
    validMetadata
  );
}

export function createSerializedPendingAuthStorage(
  key: string,
  storage: () => StringStorage | undefined
): PendingAuthStorage {
  let fallback: string | null = null;
  return {
    get() {
      const raw = storage()?.getItem(key) ?? fallback;
      if (!raw) {
        return null;
      }
      try {
        const pending: unknown = JSON.parse(raw);
        if (!isWeChatPendingAuth(pending)) {
          this.clear();
          return null;
        }
        return pending;
      } catch {
        this.clear();
        return null;
      }
    },
    set(pending) {
      const raw = JSON.stringify(pending);
      const target = storage();
      if (target) {
        target.setItem(key, raw);
      } else {
        fallback = raw;
      }
    },
    clear() {
      storage()?.removeItem(key);
      fallback = null;
    },
  };
}

export function createMemoryPendingAuthStorage(): PendingAuthStorage {
  let pending: WeChatPendingAuth | null = null;
  return {
    get: () => pending,
    set: (value) => {
      pending = value;
    },
    clear: () => {
      pending = null;
    },
  };
}
