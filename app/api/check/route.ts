import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractInvoice, extractRateCard } from '@/lib/rateguard-ai';
import { checkInvoice, duplicateKey, invoiceAmount, type ContractItem, type InvoiceResult } from '@/lib/rateguard';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;

const MAX_TEXT = 60_000;
const Body = z.object({
  contractText: z.string().min(20).max(MAX_TEXT),
  invoices: z.array(z.object({ name: z.string().max(200), text: z.string().min(20).max(MAX_TEXT) })).min(1).max(4),
  // sample runs never touch the database, so re-running the demo never reports its own earlier run as a duplicate
  sample: z.boolean().optional(),
  // invoices already checked in this browser session (used when Supabase is not available)
  history: z.array(z.string().max(400)).max(50).optional()
});

// Best-effort per-IP limit. The endpoint is open (no login) and spends OpenAI credit.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 12;
}

const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export type Duplicate = { source: 'this session' | 'database'; key: string } | null;
export type CheckResponse = {
  rateCard: ContractItem[];
  results: Array<InvoiceResult & { name: string; key: string; amount: number; duplicate: Duplicate }>;
  recoverable: number;
  duplicateStore: 'database' | 'session only';
};

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  if (limited(ip)) return NextResponse.json({ error: 'Too many checks. Please wait a few minutes and try again.' }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send a contract and at least one invoice as text (up to 60,000 characters each).' }, { status: 400 });
  const { contractText, invoices, sample, history } = parsed.data;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'The server has no OpenAI key configured.' }, { status: 503 });

  let rateCard: ContractItem[];
  let extracted;
  try {
    [rateCard, extracted] = await Promise.all([extractRateCard(contractText), Promise.all(invoices.map((i) => extractInvoice(i.text)))]);
  } catch (e) {
    console.error('rateguard extract failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not read the documents. Check they are the right files and try again.' }, { status: 502 });
  }
  if (!rateCard.length) return NextResponse.json({ error: 'No rate card was found in the contract.' }, { status: 422 });
  const empty = extracted.findIndex((x) => !x.lines.length);
  if (empty >= 0) return NextResponse.json({ error: `No line items were found in "${invoices[empty].name}".` }, { status: 422 });

  const db = !sample && supabaseConfigured() ? createAdminClient() : null;
  let dbUsable = db !== null;
  const seen = new Set<string>(history ?? []);
  const results: CheckResponse['results'] = [];

  for (let i = 0; i < extracted.length; i++) {
    const inv = extracted[i];
    const key = duplicateKey(inv);
    let duplicate: Duplicate = null;
    if (seen.has(key)) duplicate = { source: 'this session', key };
    seen.add(key);

    if (db && dbUsable) {
      try {
        const { data, error } = await db.from('rateguard_invoices').select('dup_key').eq('dup_key', key).maybeSingle();
        if (error) throw error;
        if (data && !duplicate) duplicate = { source: 'database', key };
        if (!data) {
          const { error: insErr } = await db.from('rateguard_invoices').insert({ dup_key: key, vendor: inv.vendor, invoice_number: inv.invoiceNumber, amount: invoiceAmount(inv) });
          if (insErr) throw insErr;
        }
      } catch {
        dbUsable = false; // table missing or Supabase unreachable: carry on with the in-page check
      }
    }
    results.push({ ...checkInvoice(inv, rateCard), name: invoices[i].name, key, amount: invoiceAmount(inv), duplicate });
  }

  const recoverable = Math.round(results.reduce((s, r) => s + r.recoverable, 0) * 100) / 100;
  const body: CheckResponse = { rateCard, results, recoverable, duplicateStore: db && dbUsable ? 'database' : 'session only' };
  return NextResponse.json(body);
}
