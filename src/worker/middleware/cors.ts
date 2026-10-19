import { cors } from "hono/cors";

const DEV_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
]);

export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      if (origin && DEV_ORIGINS.has(origin)) return origin;
      try {
        const reqOrigin = new URL(c.req.url).origin;
        if (origin && origin === reqOrigin) return origin;
      } catch {
        // ignore
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
  });
}
