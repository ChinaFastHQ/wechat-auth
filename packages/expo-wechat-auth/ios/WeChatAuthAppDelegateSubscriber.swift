import ExpoModulesCore
import WechatOpenSDK

public final class WeChatAuthAppDelegateSubscriber: ExpoAppDelegateSubscriber, WXApiDelegate {
  public func application(_ application: UIApplication, handleOpen url: URL) -> Bool {
    WXApi.handleOpen(url, delegate: self)
  }

  public func application(
    _ application: UIApplication,
    open url: URL,
    sourceApplication: String?,
    annotation: Any
  ) -> Bool {
    WXApi.handleOpen(url, delegate: self)
  }

  public func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    WXApi.handleOpen(url, delegate: self)
  }

  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([any UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    WXApi.handleOpenUniversalLink(userActivity, delegate: self)
  }

  public func onReq(_ request: BaseReq) {}

  public func onResp(_ response: BaseResp) {
    guard let authResponse = response as? SendAuthResp else { return }
    ExpoWeChatAuthModule.current?.completeAuthorization(authResponse)
  }
}
