import { HttpError } from "@/src/lib/http";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getClientIp(req: Request) {
  return firstHeaderValue(req.headers.get("x-forwarded-for"))
    || req.headers.get("x-real-ip")
    || "unknown";
}

function getTrustedOrigins(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const trusted = new Set<string>();

  if (forwardedHost) {
    trusted.add(`${forwardedProto}://${forwardedHost}`);
  }

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicAppUrl) {
    trusted.add(publicAppUrl.replace(/\/$/, ""));
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    trusted.add(`https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`);
  }

  return trusted;
}

export function assertTrustedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return;
  }

  const normalizedOrigin = origin.replace(/\/$/, "");
  if (!getTrustedOrigins(req).has(normalizedOrigin)) {
    throw new HttpError(403, "Blocked origin.");
  }
}

export function enforceRateLimit(
  req: Request,
  namespace: string,
  maxRequests: number,
  windowMs: number,
) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${namespace}:${ip}`;
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= maxRequests) {
    throw new HttpError(429, "Too many requests. Please try again later.");
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
}

