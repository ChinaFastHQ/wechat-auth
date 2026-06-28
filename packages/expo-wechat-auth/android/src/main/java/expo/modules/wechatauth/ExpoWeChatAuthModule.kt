package expo.modules.wechatauth

import android.content.Intent
import com.tencent.mm.opensdk.modelbase.BaseReq
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelmsg.SendAuth
import com.tencent.mm.opensdk.openapi.IWXAPI
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class WeChatAuthorizeOptions : Record {
  @Field
  val appId: String = ""

  @Field
  val universalLink: String? = null

  @Field
  val wechatScope: String = "snsapi_userinfo"

  @Field
  val state: String = ""
}

class ExpoWeChatAuthModule : Module(), IWXAPIEventHandler {
  companion object {
    private var current: ExpoWeChatAuthModule? = null

    @JvmStatic
    fun handleIntent(intent: Intent) {
      current?.routeIntent(intent)
    }
  }

  private var api: IWXAPI? = null
  private var registeredAppId: String? = null
  private var pendingAuthorization: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoWeChatAuth")

    OnCreate {
      current = this@ExpoWeChatAuthModule
    }

    OnDestroy {
      rejectPending("ERR_MODULE_DESTROYED", "The WeChat auth module was destroyed.")
      if (current === this@ExpoWeChatAuthModule) current = null
      api = null
    }

    AsyncFunction("isInstalled") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.packageManager.getLaunchIntentForPackage("com.tencent.mm") != null
    }

    AsyncFunction("isAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.packageManager.getLaunchIntentForPackage("com.tencent.mm") != null
    }

    AsyncFunction("authorize") { options: WeChatAuthorizeOptions, promise: Promise ->
      if (pendingAuthorization != null) {
        promise.reject("ERR_AUTH_IN_PROGRESS", "Another WeChat authorization request is already active.", null)
        return@AsyncFunction
      }
      if (options.appId.isBlank()) {
        promise.reject("ERR_INVALID_APP_ID", "A WeChat app ID is required.", null)
        return@AsyncFunction
      }
      if (options.state.isBlank()) {
        promise.reject("ERR_INVALID_STATE", "OAuth state is required.", null)
        return@AsyncFunction
      }

      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_NO_ACTIVITY", "The React Native application context is unavailable.", null)
        return@AsyncFunction
      }

      if (api == null || registeredAppId != options.appId) {
        api = WXAPIFactory.createWXAPI(context, options.appId, true)
        if (api?.registerApp(options.appId) != true) {
          api = null
          promise.reject("ERR_REGISTRATION_FAILED", "The WeChat SDK rejected app registration.", null)
          return@AsyncFunction
        }
        registeredAppId = options.appId
      }

      if (api?.isWXAppInstalled != true) {
        promise.reject("ERR_WECHAT_NOT_INSTALLED", "The WeChat app is not installed.", null)
        return@AsyncFunction
      }

      val request = SendAuth.Req().apply {
        scope = options.wechatScope
        state = options.state
      }
      pendingAuthorization = promise
      if (api?.sendReq(request) != true) {
        rejectPending("ERR_REQUEST_NOT_SENT", "The WeChat app did not accept the authorization request.")
      }
    }
  }

  private fun routeIntent(intent: Intent) {
    api?.handleIntent(intent, this)
  }

  override fun onReq(request: BaseReq?) = Unit

  override fun onResp(response: BaseResp?) {
    val authResponse = response as? SendAuth.Resp ?: return
    val promise = pendingAuthorization ?: return
    pendingAuthorization = null
    promise.resolve(
      mapOf(
        "code" to authResponse.code,
        "state" to authResponse.state,
        "errorCode" to authResponse.errCode,
        "errorMessage" to authResponse.errStr,
        "cancelled" to (authResponse.errCode == BaseResp.ErrCode.ERR_USER_CANCEL)
      )
    )
  }

  private fun rejectPending(code: String, message: String) {
    val promise = pendingAuthorization ?: return
    pendingAuthorization = null
    promise.reject(code, message, null)
  }
}
