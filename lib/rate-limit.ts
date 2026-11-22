// Best-effort per-IP limit (in memory, resets on restart). The API is open (no login) and spends OpenAI credit.
const hits = new Map<string, number[]>();

export function limited(req: Request, max = 15): boolean {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

export const validOwner = (o: unknown): o is string => typeof o === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(o);
