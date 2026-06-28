import { useEffect, useState } from "react";
import { WeChatAuth } from "../core.js";
import type { WeChatAuthorizeResult } from "../types.js";

export function useWeChatRedirectCallback(url?: string) {
  const [result, setResult] = useState<WeChatAuthorizeResult | null>(null);

  useEffect(() => {
    const target = url || (typeof window !== "undefined" ? window.location.href : undefined);
    if (!target) {
      return;
    }
    const parsed = new URL(target, "https://localhost");
    if (
      !parsed.searchParams.has("code") &&
      !parsed.searchParams.has("error") &&
      !parsed.searchParams.has("errcode")
    ) {
      return;
    }
    void WeChatAuth.handleRedirectCallback(target).then(setResult);
  }, [url]);

  return result;
}
