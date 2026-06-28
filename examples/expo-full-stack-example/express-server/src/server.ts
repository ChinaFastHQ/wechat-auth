import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Request } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import * as z from "zod";

import { auth } from "./auth.js";
import { database, redis } from "./infrastructure.js";

const app = express();
const port = Number(process.env.PORT || 4003);
const expoAppUrl = process.env.EXPO_APP_URL || "http://localhost:8081";
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(500),
  locale: z.string().trim().max(20),
});

type ProfileRow = RowDataPacket & {
  userId: string;
  bio: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
};

function headersFrom(request: Request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function requireSession(request: Request) {
  return auth.api.getSession({ headers: headersFrom(request) });
}

function asyncRoute(
  handler: (request: express.Request, response: express.Response) => Promise<unknown>
): express.RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

app.use(
  cors({
    origin: expoAppUrl,
    credentials: true,
    exposedHeaders: ["set-auth-token"],
  })
);
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());

app.get("/auth/wechat/callback", (request, response) => {
  const redirectUrl = new URL(expoAppUrl);
  for (const key of ["code", "state", "error", "errcode"] as const) {
    const value = request.query[key];
    if (typeof value === "string") {
      redirectUrl.searchParams.set(key, value);
    }
  }
  response.redirect(302, redirectUrl.toString());
});

app.get(
  "/api/profile",
  asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    if (!session) {
      return response.status(401).json({ message: "Authentication required." });
    }

    await database.execute("INSERT IGNORE INTO profile (userId, bio, locale) VALUES (?, '', '')", [
      session.user.id,
    ]);
    const [rows] = await database.query<ProfileRow[]>(
      "SELECT userId, bio, locale, createdAt, updatedAt FROM profile WHERE userId = ?",
      [session.user.id]
    );
    return response.json({ ...rows[0], name: session.user.name });
  })
);

app.put(
  "/api/profile",
  asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    if (!session) {
      return response.status(401).json({ message: "Authentication required." });
    }
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return response
        .status(400)
        .json({ message: "Invalid profile.", issues: parsed.error.issues });
    }

    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      const [userResult] = await connection.execute<ResultSetHeader>(
        "UPDATE `user` SET name = ?, updatedAt = NOW(3) WHERE id = ?",
        [parsed.data.name, session.user.id]
      );
      if (userResult.affectedRows !== 1) {
        throw new Error("Authenticated user no longer exists.");
      }
      await connection.execute(
        `INSERT INTO profile (userId, bio, locale)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE bio = VALUES(bio), locale = VALUES(locale), updatedAt = NOW(3)`,
        [session.user.id, parsed.data.bio, parsed.data.locale]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return response.json({ userId: session.user.id, ...parsed.data });
  })
);

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);
    response.status(500).json({ message: "Internal server error." });
  }
);

async function start() {
  await Promise.all([redis.connect(), database.query("SELECT 1")]);
  const server = app.listen(port, () => {
    console.log(`Full-stack example listening on http://localhost:${port}`);
  });

  async function shutdown() {
    server.close();
    await Promise.all([redis.quit(), database.end()]);
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void start().catch((error) => {
  console.error("Could not start server", error);
  process.exitCode = 1;
});
