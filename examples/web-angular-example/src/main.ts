import { Component, signal, type OnInit } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import {
  createWeChatAuth,
  type WeChatAuthorizeResult,
  type WeChatSignInResult,
} from "@chinafast/web-wechat-auth";

const redirectUri = "http://localhost:4200/";
const client = createWeChatAuth({
  web: { appId: "wx_your_open_platform_website_app_id", redirectUri },
  officialAccount: { appId: "wx_your_official_account_app_id", redirectUri },
  stateUrl: "http://localhost:4105/auth/wechat/state",
  exchangeUrl: "http://localhost:4105/auth/wechat",
});

@Component({
  selector: "app-root",
  standalone: true,
  template: `<main>
    <h1>Angular + WeChat</h1>
    <p>Standalone component using Angular signals.</p>
    <p>The included Express server validates state and exchanges the code.</p>
    <button [disabled]="loading()" (click)="signIn()">
      {{ loading() ? "Opening WeChat…" : "Continue with WeChat" }}
    </button>
    @if (result()) {
      <pre>{{ json() }}</pre>
    }
  </main>`,
})
class AppComponent implements OnInit {
  readonly loading = signal(false);
  readonly result = signal<WeChatAuthorizeResult | WeChatSignInResult | null>(null);
  json = () => JSON.stringify(this.result(), null, 2);
  async signIn() {
    this.loading.set(true);
    this.result.set(await client.signIn());
    this.loading.set(false);
  }
  async ngOnInit() {
    if (["code", "error", "errcode"].some((key) => new URL(location.href).searchParams.has(key))) {
      this.result.set(await client.handleRedirectCallback(location.href));
    }
  }
}

bootstrapApplication(AppComponent).catch(console.error);
