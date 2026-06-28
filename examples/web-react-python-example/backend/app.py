import os
import secrets
import threading
import time

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, make_response, request

load_dotenv()
app = Flask(__name__)
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5177")
state_ttl_seconds = 600
states: dict[str, float] = {}
sessions: dict[str, dict] = {}
store_lock = threading.Lock()


@app.after_request
def cors(response):
    if request.headers.get("Origin") == frontend_origin:
        response.headers["Access-Control-Allow-Origin"] = frontend_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/api/<path:_path>", methods=["OPTIONS"])
def options(_path):
    response = make_response("", 204)
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.get("/api/auth/wechat/state")
def create_state():
    state = secrets.token_urlsafe(32)
    with store_lock:
        states[state] = time.time() + state_ttl_seconds
    return jsonify({"state": state})


def consume_state(state: str) -> bool:
    with store_lock:
        expires_at = states.pop(state, None)
    return expires_at is not None and time.time() <= expires_at


def credentials_for(flow: str):
    prefix = "WECHAT_OFFICIAL_ACCOUNT" if flow == "wechat_browser_oauth" else "WECHAT_WEB"
    return os.getenv(f"{prefix}_APP_ID"), os.getenv(f"{prefix}_APP_SECRET")


@app.post("/api/auth/wechat")
def exchange_code():
    body = request.get_json(silent=True) or {}
    code, state, flow = body.get("code"), body.get("state"), body.get("flow")
    if not all(isinstance(value, str) and value for value in (code, state, flow)):
        return jsonify({"error": "code, state, and flow are required"}), 400
    if not consume_state(state):
        return jsonify({"error": "state is missing, expired, or already used"}), 400
    app_id, secret = credentials_for(flow)
    if not app_id or not secret:
        return jsonify({"error": f"server credentials are not configured for {flow}"}), 500
    token_response = requests.get("https://api.weixin.qq.com/sns/oauth2/access_token", params={"appid": app_id, "secret": secret, "code": code, "grant_type": "authorization_code"}, timeout=10)
    token = token_response.json()
    if not token_response.ok or token.get("errcode"):
        return jsonify({"error": token.get("errmsg", "WeChat token exchange failed")}), 502
    profile = {"openid": token["openid"]}
    if token.get("unionid"):
        profile["unionid"] = token["unionid"]
    scopes = {scope.strip() for scope in token.get("scope", "").split(",")}
    if scopes.intersection({"snsapi_login", "snsapi_userinfo"}):
        user_response = requests.get("https://api.weixin.qq.com/sns/userinfo", params={"access_token": token["access_token"], "openid": token["openid"], "lang": "zh_CN"}, timeout=10)
        user = user_response.json()
        if not user_response.ok or user.get("errcode"):
            return jsonify({"error": user.get("errmsg", "WeChat profile lookup failed")}), 502
        profile.update({key: user[key] for key in ("unionid", "nickname", "headimgurl") if user.get(key)})
    session_id = secrets.token_urlsafe(32)
    sessions[session_id] = {"user": profile}
    response = jsonify({"user": profile})
    response.set_cookie("wechat_demo_session", session_id, httponly=True, secure=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true", samesite="Lax", max_age=86400, path="/")
    return response


@app.get("/api/session")
def get_session():
    session = sessions.get(request.cookies.get("wechat_demo_session", ""))
    return jsonify(session) if session else (jsonify({"error": "not authenticated"}), 401)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
