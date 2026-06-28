import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { createClient } from "redis";

dotenv.config();

export const database = mysql.createPool({
  uri: process.env.DATABASE_URL || "mysql://app:app-password@localhost:3307/wechat_auth",
  connectionLimit: 10,
  enableKeepAlive: true,
});

export const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6380",
});

redis.on("error", (error) => console.error("Redis error", error));
