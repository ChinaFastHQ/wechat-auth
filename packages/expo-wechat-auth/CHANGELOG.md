# Changelog

## Unreleased

- Add an auth-only Expo native module for iOS and Android, including native WeChat SDK dependencies and callback routing.
- Replace the `react-native-wechat-lib` bridge with the bundled `ExpoWeChatAuth` module.

## 0.1.0

- Initial `@chinafast/expo-wechat-auth` package.
- Adds Expo/React Native WeChat auth flow resolution for native app auth, desktop QR login, and Official Account OAuth.
- Adds local pending-state storage with replay/expiry checks.
- Resumes backend session exchange after full-page browser callbacks.
- Bundles the native WeChat bridge and generates its Expo prebuild callback configuration.
- Adds React hooks, a config plugin, an Expo example app, and an Express backend example.
- Adds publish metadata and npm provenance configuration.
- Adds reusable backend helpers in `@chinafast/wechat-auth-server` and uses them in the Express example.
- Adds packaged Better Auth server and client plugins with injectable state storage.
