import { WeChatAuth } from "@chinafast/expo-wechat-auth";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { authClient } from "./auth-client";

const WECHAT_OPEN_APP_ID = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
const WECHAT_WEB_APP_ID = process.env.EXPO_PUBLIC_WECHAT_WEB_APP_ID;
const WECHAT_MP_APP_ID = process.env.EXPO_PUBLIC_WECHAT_MP_APP_ID;

if (!WECHAT_OPEN_APP_ID || !WECHAT_WEB_APP_ID || !WECHAT_MP_APP_ID) {
  throw new Error("Missing WeChat app IDs. Copy .env.example to .env and configure each ID.");
}

// App IDs are public; app secrets remain in the Express environment. Redirect URIs must exactly
// match the corresponding URLs registered with WeChat.
WeChatAuth.configure({
  native: {
    appId: WECHAT_OPEN_APP_ID,
    redirectUri: Linking.createURL("wechat-auth/callback"),
    universalLink: "https://example.com/app/",
  },
  web: {
    appId: WECHAT_WEB_APP_ID,
    redirectUri: "http://localhost:8081/wechat-auth/callback",
  },
  officialAccount: {
    appId: WECHAT_MP_APP_ID,
    redirectUri: "http://localhost:8081/wechat-auth/callback",
  },
  scheme: "wechatbetterauth",
  debug: true,
});

// Install native deep-link handling once, before React renders the application.
WeChatAuth.installLinkingHandler();

type SignInPayload = {
  user: unknown;
  session: unknown;
};

export default function App() {
  const [signingIn, setSigningIn] = useState(false);
  const environment = WeChatAuth.detectEnvironment();
  const {
    data: session,
    isPending: sessionPending,
    error: sessionError,
    refetch: refetchSession,
  } = authClient.useSession();
  const [result, setResult] = useState<unknown>(null);

  async function startSignIn() {
    setSigningIn(true);
    try {
      setResult(await authClient.signIn.wechat<SignInPayload>({ scope: "profile" }));
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    setResult(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>WeChat + Better Auth</Text>
      <Text selectable style={styles.code}>
        {JSON.stringify(environment, null, 2)}
      </Text>
      <View style={styles.row}>
        <Button
          title={signingIn ? "Signing in..." : "Sign in with WeChat"}
          onPress={startSignIn}
          disabled={signingIn}
        />
        <Button
          title={sessionPending ? "Loading session..." : "Refresh Better Auth session"}
          onPress={() => void refetchSession()}
          disabled={sessionPending}
        />
        <Button title="Sign out" onPress={signOut} />
      </View>
      {sessionError ? <Text style={styles.error}>{sessionError.message}</Text> : null}
      <Text style={styles.section}>Sign-In Result</Text>
      <Text selectable style={styles.code}>
        {JSON.stringify(result, null, 2)}
      </Text>
      <Text style={styles.section}>Better Auth session</Text>
      <Text selectable style={styles.code}>
        {JSON.stringify(session, null, 2)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  section: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  code: {
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    fontFamily: Platform.select({ web: "monospace" }),
  },
  error: { color: "#b91c1c", fontWeight: "600" },
});
