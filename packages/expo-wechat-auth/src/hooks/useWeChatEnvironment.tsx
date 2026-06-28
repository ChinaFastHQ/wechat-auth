import { useEffect, useState } from "react";
import { WeChatAuth } from "../core.js";
import type { WeChatAuthEnvironment } from "../types.js";

export function useWeChatEnvironment(): WeChatAuthEnvironment {
  const [environment, setEnvironment] = useState(() => WeChatAuth.detectEnvironment());
  useEffect(() => {
    setEnvironment(WeChatAuth.detectEnvironment());
  }, []);
  return environment;
}
