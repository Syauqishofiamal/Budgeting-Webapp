/**
 * Best-effort client IP for rate limiting.
 *
 * On Vercel `x-forwarded-for` is set by the platform edge, so the left-most
 * entry is the real client. Behind an untrusted proxy this header is spoofable;
 * it throttles casual abuse, not a determined attacker. Email-based limits do
 * the heavier lifting.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim().slice(0, 64);
  return req.headers.get('x-real-ip')?.slice(0, 64) ?? 'unknown';
}
