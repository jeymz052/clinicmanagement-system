export function isAuthorizedCronRequest(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  return req.headers.get("x-cron-secret") === secret;
}
