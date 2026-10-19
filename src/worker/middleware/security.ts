import { secureHeaders } from "hono/secure-headers";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

export function securityHeaders(): MiddlewareHandler<{ Bindings: Env }> {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  });
}
