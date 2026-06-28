import { WeChatAuth } from "@chinafast/expo-wechat-auth";
import { useWeChatAuth } from "@chinafast/expo-wechat-auth/react";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

const API_URL = "http://localhost:4002";
const WECHAT_OPEN_APP_ID = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
const WECHAT_WEB_APP_ID = process.env.EXPO_PUBLIC_WECHAT_WEB_APP_ID;
const WECHAT_MP_APP_ID = process.env.EXPO_PUBLIC_WECHAT_MP_APP_ID;

if (!WECHAT_OPEN_APP_ID || !WECHAT_WEB_APP_ID || !WECHAT_MP_APP_ID) {
  throw new Error("Missing WeChat app IDs. Copy .env.example to .env and configure each ID.");
}

// This is public client configuration. WeChat secrets stay in Express, while these IDs and
// redirect URIs must match the applications registered with WeChat.
WeChatAuth.configure({
  exchangeUrl: `${API_URL}/auth/wechat`,
  native: {
    appId: WECHAT_OPEN_APP_ID,
    redirectUri: Linking.createURL("wechat-auth/callback"),
    universalLink: "https://example.com/app/",
  },
  web: { appId: WECHAT_WEB_APP_ID, redirectUri: "http://localhost:8081/wechat-auth/callback" },
  officialAccount: {
    appId: WECHAT_MP_APP_ID,
    redirectUri: "http://localhost:8081/wechat-auth/callback",
  },
  scheme: "wechatpassport",
  debug: true,
});

WeChatAuth.installLinkingHandler();

type SessionPayload = { user: unknown; session: string };

export default function App() {
  const { signIn, loading, error, environment } = useWeChatAuth();
  const [result, setResult] = useState<unknown>(null);
  const [currentSession, setCurrentSession] = useState<unknown>(null);

  async function startSignIn() {
    setResult(await signIn<SessionPayload>({ scope: "profile" }));
  }

  async function loadSession() {
    const response = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
    setCurrentSession(await response.json());
  }

  async function signOut() {
    await fetch(`${API_URL}/auth/signout`, { method: "POST", credentials: "include" });
    setResult(null);
    setCurrentSession(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>WeChat + Passport.js</Text>
      <Text selectable style={styles.code}>
        {JSON.stringify(environment, null, 2)}
      </Text>
      <View style={styles.row}>
        <Button
          title={loading ? "Signing in..." : "Sign in with WeChat"}
          onPress={startSignIn}
          disabled={loading}
        />
        <Button title="Load Passport session" onPress={loadSession} />
        <Button title="Sign out" onPress={signOut} />
      </View>
      {error ? <Text style={styles.error}>{error.message}</Text> : null}
      <Text style={styles.section}>Sign-In Result</Text>
      <Text selectable style={styles.code}>
        {JSON.stringify(result, null, 2)}
      </Text>
      <Text style={styles.section}>Passport session</Text>
      <Text selectable style={styles.code}>
        {JSON.stringify(currentSession, null, 2)}
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
