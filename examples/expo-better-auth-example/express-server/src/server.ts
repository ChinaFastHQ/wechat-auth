import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { auth } from "./auth.js";

const app = express();
const port = Number(process.env.PORT || 4001);
const expoAppUrl = process.env.EXPO_APP_URL || "http://localhost:8081";

app.use(cors({ origin: true, credentials: true, exposedHeaders: ["set-auth-token"] }));
// Better Auth must receive its routes before express.json(); its Node handler reads the body.
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());

app.get("/auth/wechat/callback", (req, res) => {
  // Optional server relay for deployments that cannot register the Expo app URL directly.
  const redirectUrl = new URL(expoAppUrl);
  for (const key of ["code", "state", "error", "errcode"] as const) {
    const value = req.query[key];
    if (typeof value === "string") {
      redirectUrl.searchParams.set(key, value);
    }
  }
  res.redirect(302, redirectUrl.toString());
});

app.listen(port, () => {
  console.log(`Better Auth example listening on http://localhost:${port}`);
});
