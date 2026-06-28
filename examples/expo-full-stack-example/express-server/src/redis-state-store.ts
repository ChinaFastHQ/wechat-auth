import { randomBytes } from "node:crypto";

const STATE_PREFIX = "wechat-auth:oauth-state:";

export type RedisStateClient = {
  set(key: string, value: string, options: { EX: number; NX: true }): Promise<unknown>;
  getDel(key: string): Promise<string | null>;
};

export function createRedisStateStore(redis: RedisStateClient, ttlSeconds = 10 * 60) {
  return {
    async create() {
      const state = randomBytes(24).toString("base64url");
      await redis.set(`${STATE_PREFIX}${state}`, "1", { EX: ttlSeconds, NX: true });
      return { state, expiresAt: Date.now() + ttlSeconds * 1000 };
    },
    async consume(state: string) {
      // GETDEL makes validation one-time and atomic across every server instance.
      return (await redis.getDel(`${STATE_PREFIX}${state}`)) !== null;
    },
  };
}
