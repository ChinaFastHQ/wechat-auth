# React SPA + custom Python backend

This example uses `@chinafast/web-wechat-auth` in a React SPA and implements the complete backend protocol directly in Python. It does **not** use `@chinafast/wechat-auth-server`.

## Run

1. Copy `backend/.env.example` to `backend/.env` and add the appropriate WeChat app IDs and secrets.
2. Copy `frontend/.env.example` to `frontend/.env`. The public IDs must match the backend credentials.
3. In `backend`, create a virtual environment and run `pip install -r requirements.txt`, then `python app.py`.
4. From the repository root, run `pnpm --filter web-wechat-auth-react-python-frontend dev`.
5. Register `http://localhost:5177/` as the callback URL with WeChat.

The in-memory state and session stores make the security boundary visible but are not durable. Use Redis or a database in production, serve both applications over HTTPS, restrict origins, rotate sessions, and add CSRF protection to state-changing authenticated endpoints.
