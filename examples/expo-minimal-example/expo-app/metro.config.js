const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const upstreamResolveRequest = config.resolver.resolveRequest;
const wechatAuthSrc = path.resolve(__dirname, "../../../packages/expo-wechat-auth/src");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRelativeJsImport =
    (moduleName.startsWith("./") || moduleName.startsWith("../")) && moduleName.endsWith(".js");
  const isWechatAuthSource = context.originModulePath.startsWith(wechatAuthSrc);

  if (isRelativeJsImport && isWechatAuthSource) {
    const withoutJs = moduleName.slice(0, -3);
    const originDir = path.dirname(context.originModulePath);

    for (const extension of [".ts", ".tsx"]) {
      const candidate = path.resolve(originDir, `${withoutJs}${extension}`);

      if (fs.existsSync(candidate)) {
        return {
          type: "sourceFile",
          filePath: candidate,
        };
      }
    }
  }

  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
