import {
  MissingNativeWeChatAuthProvider,
  ReactNativeModuleWeChatAuthProvider,
  type NativeWeChatAuthProvider,
} from "./NativeWeChatAuthProvider.js";

let provider: NativeWeChatAuthProvider | undefined;

export function setNativeWeChatAuthProvider(nextProvider: NativeWeChatAuthProvider): void {
  provider = nextProvider;
}

export function getNativeWeChatAuthProvider(): NativeWeChatAuthProvider {
  if (provider) {
    return provider;
  }
  return new ReactNativeModuleWeChatAuthProvider();
}

export function getMissingNativeWeChatAuthProvider(): NativeWeChatAuthProvider {
  return new MissingNativeWeChatAuthProvider();
}
