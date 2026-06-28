import { useCallback, useEffect, useMemo, useState } from "react";
import { WeChatAuth } from "../core.js";
import type {
  WeChatAuthError,
  WeChatAuthEnvironment,
  WeChatAuthorizeInput,
  WeChatAuthorizeResult,
  WeChatPendingAuth,
  WeChatSignInInput,
  WeChatSignInResult,
} from "../types.js";

export function useWeChatAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WeChatAuthError | null>(null);
  const [environment, setEnvironment] = useState<WeChatAuthEnvironment>(() =>
    WeChatAuth.detectEnvironment()
  );
  const [pendingAuth, setPendingAuthState] = useState<WeChatPendingAuth | null>(() =>
    WeChatAuth.getPendingAuth()
  );

  useEffect(() => {
    setEnvironment(WeChatAuth.detectEnvironment());
    setPendingAuthState(WeChatAuth.getPendingAuth());
    return WeChatAuth.addAuthListener((result) => {
      setPendingAuthState(WeChatAuth.getPendingAuth());
      if (result.status === "failed") {
        setError(result.error);
      }
    });
  }, []);

  const runAuthorize = useCallback(async (fn: () => Promise<WeChatAuthorizeResult>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (result.status === "failed") {
        setError(result.error);
      }
      setPendingAuthState(WeChatAuth.getPendingAuth());
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const runSignIn = useCallback(
    async <TSession,>(
      fn: () => Promise<WeChatSignInResult<TSession>>
    ): Promise<WeChatSignInResult<TSession>> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn();
        if (result.status === "error") {
          setError({ code: "UNKNOWN", message: result.error.message, cause: result.error.code });
        }
        setPendingAuthState(WeChatAuth.getPendingAuth());
        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const authorize = useCallback(
    (input?: WeChatAuthorizeInput) => runAuthorize(() => WeChatAuth.authorize(input)),
    [runAuthorize]
  );
  const signIn = useCallback(
    <TSession = unknown,>(input?: WeChatSignInInput) =>
      runSignIn(() => WeChatAuth.signIn<TSession>(input)),
    [runSignIn]
  );
  const signInWithRedirect = useCallback(
    (input?: WeChatAuthorizeInput) => runAuthorize(() => WeChatAuth.signInWithRedirect(input)),
    [runAuthorize]
  );
  const handleRedirectCallback = useCallback(
    (url: string) => runAuthorize(() => WeChatAuth.handleRedirectCallback(url)),
    [runAuthorize]
  );

  return useMemo(
    () => ({
      signIn,
      authorize,
      signInWithRedirect,
      handleRedirectCallback,
      createAuthUrl: WeChatAuth.createAuthUrl,
      loading,
      error,
      environment,
      pendingAuth,
    }),
    [
      signIn,
      authorize,
      signInWithRedirect,
      handleRedirectCallback,
      loading,
      error,
      environment,
      pendingAuth,
    ]
  );
}
