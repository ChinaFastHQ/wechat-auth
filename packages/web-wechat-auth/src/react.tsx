import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  WeChatAuthClient,
  WeChatAuthError,
  WeChatAuthorizeInput,
  WeChatAuthorizeResult,
  WeChatSignInInput,
  WeChatSignInResult,
} from "@chinafast/wechat-auth-core";

const ClientContext = createContext<WeChatAuthClient | null>(null);
const callbackJobs = new WeakMap<WeChatAuthClient, Map<string, Promise<WeChatAuthorizeResult>>>();

export function WeChatAuthProvider({
  client,
  children,
}: PropsWithChildren<{ client: WeChatAuthClient }>) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

function clientFrom(argument?: WeChatAuthClient): WeChatAuthClient {
  const context = useContext(ClientContext);
  const client = argument || context;
  if (!client) {
    throw new Error("Pass a WeChat auth client or render inside WeChatAuthProvider.");
  }
  return client;
}

function callbackOnce(client: WeChatAuthClient, url: string): Promise<WeChatAuthorizeResult> {
  let jobs = callbackJobs.get(client);
  if (!jobs) {
    jobs = new Map();
    callbackJobs.set(client, jobs);
  }
  const existing = jobs.get(url);
  if (existing) {
    return existing;
  }
  const job = client.handleRedirectCallback(url);
  jobs.set(url, job);
  return job;
}

export function useWeChatAuth(clientArgument?: WeChatAuthClient) {
  const client = clientFrom(clientArgument);
  const mounted = useRef(true);
  const active = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WeChatAuthError | null>(null);
  const [environment, setEnvironment] = useState(() => client.detectEnvironment());
  const [pendingAuth, setPendingAuth] = useState(() => client.getPendingAuth());
  useEffect(() => {
    mounted.current = true;
    setEnvironment(client.detectEnvironment());
    setPendingAuth(client.getPendingAuth());
    const unsubscribe = client.addAuthListener((result) => {
      if (!mounted.current) {
        return;
      }
      setPendingAuth(client.getPendingAuth());
      if (result.status === "failed") {
        setError(result.error);
      }
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [client]);
  const run = useCallback(
    async <T,>(
      job: () => Promise<T>,
      readError: (result: T) => WeChatAuthError | null
    ): Promise<T> => {
      active.current += 1;
      if (mounted.current) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await job();
        if (mounted.current) {
          setError(readError(result));
          setPendingAuth(client.getPendingAuth());
        }
        return result;
      } finally {
        active.current -= 1;
        if (mounted.current && active.current === 0) {
          setLoading(false);
        }
      }
    },
    [client]
  );
  const authorize = useCallback(
    (input?: WeChatAuthorizeInput) =>
      run(
        () => client.authorize(input),
        (result) => (result.status === "failed" ? result.error : null)
      ),
    [client, run]
  );
  const signIn = useCallback(
    <TSession = unknown,>(input?: WeChatSignInInput) =>
      run<WeChatSignInResult<TSession>>(
        () => client.signIn<TSession>(input),
        (result) =>
          result.status === "error"
            ? { code: "UNKNOWN", message: result.error.message, cause: result.error.code }
            : null
      ),
    [client, run]
  );
  const signInWithRedirect = useCallback(
    (input?: WeChatAuthorizeInput) =>
      run(
        () => client.signInWithRedirect(input),
        (result) => (result.status === "failed" ? result.error : null)
      ),
    [client, run]
  );
  const handleRedirectCallback = useCallback(
    (url: string) =>
      run(
        () => callbackOnce(client, url),
        (result) => (result.status === "failed" ? result.error : null)
      ),
    [client, run]
  );
  return useMemo(
    () => ({
      authorize,
      signIn,
      signInWithRedirect,
      handleRedirectCallback,
      createAuthUrl: client.createAuthUrl,
      loading,
      error,
      environment,
      pendingAuth,
    }),
    [
      authorize,
      signIn,
      signInWithRedirect,
      handleRedirectCallback,
      client,
      loading,
      error,
      environment,
      pendingAuth,
    ]
  );
}

export function useWeChatEnvironment(clientArgument?: WeChatAuthClient) {
  const client = clientFrom(clientArgument);
  const [environment, setEnvironment] = useState(() => client.detectEnvironment());
  useEffect(() => setEnvironment(client.detectEnvironment()), [client]);
  return environment;
}

export function useWeChatRedirectCallback(clientArgument?: WeChatAuthClient, url?: string) {
  const client = clientFrom(clientArgument);
  const [result, setResult] = useState<WeChatAuthorizeResult | null>(null);
  useEffect(() => {
    let active = true;
    const target = url || (typeof window !== "undefined" ? window.location.href : undefined);
    if (!target) {
      return () => {
        active = false;
      };
    }
    const parsed = new URL(target, "https://localhost");
    if (!["code", "error", "errcode"].some((key) => parsed.searchParams.has(key))) {
      return () => {
        active = false;
      };
    }
    void callbackOnce(client, target).then((value) => {
      if (active) {
        setResult(value);
      }
    });
    return () => {
      active = false;
    };
  }, [client, url]);
  return result;
}
