import {
  createMemoryStateStore,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  type WeChatServerCredentials,
  type WeChatUserInfo,
} from "@chinafast/wechat-auth-server";
import type { WeChatAuthFlow } from "@chinafast/wechat-auth-core";
import type { Request } from "express";
import { Strategy } from "passport-strategy";

export type DemoUser = {
  id: string;
  name: string;
  avatar?: string | null;
  provider: "wechat";
  openid: string;
  unionid?: string;
};

type AuthBody = {
  code?: string;
  state?: string;
  flow?: WeChatAuthFlow;
  redirectUri?: string;
};

type WeChatStrategyOptions = {
  credentials: WeChatServerCredentials;
  users: Map<string, DemoUser>;
};

export class WeChatStrategy extends Strategy {
  name = "wechat";
  // The demo keeps state in memory. A distributed deployment needs a shared state store.
  readonly stateStore = createMemoryStateStore();

  constructor(private readonly options: WeChatStrategyOptions) {
    super();
  }

  override async authenticate(req: Request) {
    try {
      const body = req.body as AuthBody;
      if (!body.code || !body.state || !body.redirectUri) {
        this.fail({ message: "code, state, and redirectUri are required." }, 400);
        return;
      }

      const stateResult = this.stateStore.consume(body.state);
      if (!stateResult.ok) {
        this.fail(
          { message: stateResult.reason === "expired" ? "State expired." : "Invalid state." },
          400
        );
        return;
      }

      // Code exchange is server-side because it requires the WeChat application secret.
      const token = await exchangeWeChatCode(
        { code: body.code, flow: body.flow },
        { credentials: this.options.credentials }
      );
      const profile: WeChatUserInfo = await fetchWeChatUserInfo(token);

      const externalId = profile.unionid || profile.openid;
      const user = this.options.users.get(externalId) || {
        id: `user_${this.options.users.size + 1}`,
        name: profile.nickname || "WeChat User",
        avatar: profile.headimgurl,
        provider: "wechat" as const,
        openid: profile.openid,
        unionid: profile.unionid,
      };
      this.options.users.set(externalId, user);
      this.success(user);
    } catch (error) {
      this.error(error instanceof Error ? error : new Error("Unknown WeChat auth error"));
    }
  }
}
