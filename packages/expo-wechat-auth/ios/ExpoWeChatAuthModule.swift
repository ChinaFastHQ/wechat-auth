import ExpoModulesCore
import WechatOpenSDK

struct WeChatAuthorizeOptions: Record {
  @Field var appId: String = ""
  @Field var universalLink: String?
  @Field var wechatScope: String = "snsapi_userinfo"
  @Field var state: String = ""
}

public final class ExpoWeChatAuthModule: Module {
  static weak var current: ExpoWeChatAuthModule?

  private var pendingAuthorization: Promise?

  public func definition() -> ModuleDefinition {
    Name("ExpoWeChatAuth")

    OnCreate {
      Self.current = self
    }

    OnDestroy {
      self.rejectPending(code: "ERR_MODULE_DESTROYED", message: "The WeChat auth module was destroyed.")
      if Self.current === self {
        Self.current = nil
      }
    }

    AsyncFunction("isInstalled") {
      WXApi.isWXAppInstalled()
    }

    AsyncFunction("isAvailable") {
      WXApi.isWXAppInstalled()
    }

    AsyncFunction("authorize") { (options: WeChatAuthorizeOptions, promise: Promise) in
      guard self.pendingAuthorization == nil else {
        promise.reject("ERR_AUTH_IN_PROGRESS", "Another WeChat authorization request is already active.")
        return
      }
      guard !options.appId.isEmpty else {
        promise.reject("ERR_INVALID_APP_ID", "A WeChat app ID is required.")
        return
      }
      guard !options.state.isEmpty else {
        promise.reject("ERR_INVALID_STATE", "OAuth state is required.")
        return
      }

      let registered = WXApi.registerApp(options.appId, universalLink: options.universalLink ?? "")
      guard registered else {
        promise.reject("ERR_REGISTRATION_FAILED", "The WeChat SDK rejected app registration.")
        return
      }
      guard WXApi.isWXAppInstalled() else {
        promise.reject("ERR_WECHAT_NOT_INSTALLED", "The WeChat app is not installed.")
        return
      }

      let request = SendAuthReq()
      request.scope = options.wechatScope
      request.state = options.state
      self.pendingAuthorization = promise
      WXApi.send(request) { accepted in
        if !accepted {
          self.rejectPending(code: "ERR_REQUEST_NOT_SENT", message: "The WeChat app did not accept the authorization request.")
        }
      }
    }
  }

  func completeAuthorization(_ response: SendAuthResp) {
    guard let promise = pendingAuthorization else { return }
    pendingAuthorization = nil
    let payload: [String: Any?] = [
      "code": response.code,
      "state": response.state,
      "errorCode": response.errCode,
      "errorMessage": response.errStr,
      "cancelled": response.errCode == -2
    ]
    promise.resolve(payload)
  }

  private func rejectPending(code: String, message: String) {
    guard let promise = pendingAuthorization else { return }
    pendingAuthorization = nil
    promise.reject(code, message)
  }
}
