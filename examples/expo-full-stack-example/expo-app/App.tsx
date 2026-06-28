import { WeChatAuth } from "@chinafast/expo-wechat-auth";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { API_URL, authClient } from "./auth-client";

const WECHAT_OPEN_APP_ID = process.env.EXPO_PUBLIC_WECHAT_OPEN_APP_ID;
const WECHAT_WEB_APP_ID = process.env.EXPO_PUBLIC_WECHAT_WEB_APP_ID;
const WECHAT_MP_APP_ID = process.env.EXPO_PUBLIC_WECHAT_MP_APP_ID;

if (!WECHAT_OPEN_APP_ID || !WECHAT_WEB_APP_ID || !WECHAT_MP_APP_ID) {
  throw new Error("Missing WeChat app IDs. Copy .env.example to .env and configure each ID.");
}

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
  scheme: "wechatfullstack",
  debug: true,
});

WeChatAuth.installLinkingHandler();

type SignInPayload = { user: unknown; session: unknown };
type Profile = { userId: string; name: string; bio: string; locale: string };

async function profileRequest(method: "GET" | "PUT", body?: Omit<Profile, "userId">) {
  const { data, error } = await authClient.$fetch<Profile>(`${API_URL}/api/profile`, {
    method,
    body,
  });
  if (error) {
    throw new Error(error.message || "Profile request failed.");
  }
  return data;
}

function AccountScreen() {
  const { data: session, isPending: sessionLoading, error: sessionError } = authClient.useSession();
  const [signInLoading, setSignInLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [locale, setLocale] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const value = await profileRequest("GET");
      setProfile(value);
      setName(value.name);
      setBio(value.bio);
      setLocale(value.locale);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load profile.");
    }
  }, []);

  useEffect(() => {
    if (session) {
      void loadProfile();
    } else {
      setProfile(null);
    }
  }, [loadProfile, session]);

  async function startSignIn() {
    setSignInLoading(true);
    setMessage(null);
    try {
      const result = await authClient.signIn.wechat<SignInPayload>({ scope: "profile" });
      if (result.status === "error") {
        throw new Error(result.error.message || "Sign-in failed.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setSignInLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const value = await profileRequest("PUT", { name, bio, locale });
      setProfile(value);
      setMessage("Profile saved to MySQL.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.eyebrow}>FULL-STACK EXAMPLE</Text>
      <Text style={styles.title}>WeChat account</Text>
      <Text style={styles.subtitle}>Better Auth · MySQL · Redis · Expo</Text>

      {!session ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.copy}>Use WeChat to create a durable account and session.</Text>
          <Button
            title={signInLoading ? "Opening WeChat…" : "Continue with WeChat"}
            onPress={startSignIn}
            disabled={signInLoading}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.identity}>
            {session.user.image ? (
              <Image source={{ uri: session.user.image }} style={styles.avatar} />
            ) : null}
            <View style={styles.grow}>
              <Text style={styles.heading}>{profile?.name || session.user.name}</Text>
              <Text style={styles.muted}>{session.user.email}</Text>
            </View>
            <Button title="Sign out" onPress={() => void authClient.signOut()} />
          </View>

          <Text style={styles.label}>Display name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={100} />
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={bio}
            onChangeText={setBio}
            maxLength={500}
            multiline
          />
          <Text style={styles.label}>Locale</Text>
          <TextInput
            style={styles.input}
            value={locale}
            onChangeText={setLocale}
            placeholder="zh-CN"
            maxLength={20}
          />
          <Button
            title={saving ? "Saving…" : "Save profile"}
            onPress={saveProfile}
            disabled={saving}
          />
        </View>
      )}

      {sessionError ? <Text style={styles.error}>{sessionError.message}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

export default function App() {
  return <AccountScreen />;
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  container: { flexGrow: 1, padding: 24, gap: 12, backgroundColor: "#f4f7f5" },
  eyebrow: { color: "#167347", fontWeight: "700", letterSpacing: 1.5 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "800", color: "#17211b" },
  subtitle: { color: "#607068", marginBottom: 12 },
  card: {
    width: "100%",
    maxWidth: 640,
    padding: 24,
    gap: 12,
    backgroundColor: "white",
    borderRadius: 16,
    ...Platform.select({ web: { boxShadow: "0 10px 30px rgba(20, 45, 30, 0.08)" } }),
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  grow: { flex: 1 },
  heading: { fontSize: 20, fontWeight: "700", color: "#17211b" },
  copy: { color: "#526159", marginBottom: 8 },
  muted: { color: "#78847e", fontSize: 12 },
  label: { color: "#34463c", fontWeight: "600", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd6d0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  error: { color: "#b42318", fontWeight: "600" },
  message: { color: "#245b3d" },
});
