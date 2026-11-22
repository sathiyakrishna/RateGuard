import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractInvoice } from '@/lib/rateguard-ai';
import { checkInvoice, duplicateKey, invoiceAmount, matchContract, type Invoice, type InvoiceResult } from '@/lib/rateguard';
import { createAdminClient } from '@/lib/supabase/admin';
import { limited, validOwner } from '@/lib/rate-limit';

export const maxDuration = 60;

const MAX_TEXT = 60_000;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const Item = z.object({
  item: z.string().min(1).max(300),
  unit: z.string().max(100).nullable(),
  rate: z.number().finite(),
  currency: z.string().max(8),
  validFrom: date,
  validTo: date,
  clause: z.string().max(100).nullable()
});
const Body = z.object({
  invoice: z.object({ name: z.string().max(200), text: z.string().min(20).max(MAX_TEXT) }),
  // the saved contracts, sent by the browser (it holds them in localStorage, or loaded them from /api/contracts)
  contracts: z.array(z.object({ id: z.string().max(80), vendor: z.string().max(300), items: z.array(Item).min(1).max(300) })).max(50),
  owner: z.string().optional(),
  // sample runs never touch the database, so re-running the demo never reports its own earlier run as a duplicate
  sample: z.boolean().optional(),
  // invoices already checked in this browser session (used when Supabase is not available)
  history: z.array(z.object({ key: z.string().max(400), label: z.string().max(200) })).max(50).optional(),
  // invoices to treat as already seen (the sample "duplicate" needs the clean invoice before it)
  seed: z.array(z.object({ name: z.string().max(200), text: z.string().min(20).max(MAX_TEXT) })).max(2).optional()
});

export type Duplicate = { source: 'this session' | 'database'; of: string } | null;
export type CheckResponse = {
  invoice: Invoice;
  name: string;
  key: string;
  amount: number;
  contract: { id: string; vendor: string; rates: number } | null; // null: no contract on file for this vendor
  result: InvoiceResult | null;
  duplicate: Duplicate;
  duplicateStore: 'database' | 'session only';
};

export async function POST(req: Request) {
  if (limited(req)) return NextResponse.json({ error: 'Too many checks. Please wait a few minutes and try again.' }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send one invoice as text (up to 60,000 characters).' }, { status: 400 });
  const { invoice: file, contracts, owner, sample, history, seed } = parsed.data;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'The server has no OpenAI key configured.' }, { status: 503 });

  let inv: Invoice;
  let seeded: Invoice[] = [];
  try {
    [inv, seeded] = await Promise.all([extractInvoice(file.text), Promise.all((seed ?? []).map((s) => extractInvoice(s.text)))]);
  } catch (e) {
    console.error('rateguard extract failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not read the invoice. Check it is the right file and try again.' }, { status: 502 });
  }
  if (!inv.lines.length) return NextResponse.json({ error: `No line items were found in "${file.name}".` }, { status: 422 });

  const key = duplicateKey(inv);
  const seen = new Map<string, string>((history ?? []).map((h) => [h.key, h.label]));
  seeded.forEach((s, i) => seen.set(duplicateKey(s), seed![i].name));
  let duplicate: Duplicate = seen.has(key) ? { source: 'this session', of: seen.get(key)! } : null;

  const saved = matchContract(inv.vendor, contracts);
  const result = saved ? checkInvoice(inv, saved.items) : null;

  // database duplicate memory: only for real runs with a contract on file (nothing was checked otherwise)
  let store: CheckResponse['duplicateStore'] = 'session only';
  if (!sample && saved && validOwner(owner) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = createAdminClient();
      const dupKey = `${owner}|${key}`;
      const { data, error } = await db.from('rateguard_invoices').select('dup_key').eq('dup_key', dupKey).maybeSingle();
      if (error) throw error;
      if (data && !duplicate) duplicate = { source: 'database', of: 'an invoice checked earlier' };
      if (!data) {
        const { error: insErr } = await db.from('rateguard_invoices').insert({ dup_key: dupKey, vendor: inv.vendor, invoice_number: inv.invoiceNumber, amount: invoiceAmount(inv) });
        if (insErr) throw insErr;
      }
      store = 'database';
    } catch {
      /* table missing or Supabase unreachable: the in-page check still applies */
    }
  }

  const body: CheckResponse = {
    invoice: inv,
    name: file.name,
    key,
    amount: invoiceAmount(inv),
    contract: saved ? { id: saved.id, vendor: saved.vendor, rates: saved.items.length } : null,
    result,
    duplicate,
    duplicateStore: store
  };
  return NextResponse.json(body);
}
