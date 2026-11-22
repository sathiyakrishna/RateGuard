import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractContract } from '@/lib/rateguard-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { limited, validOwner } from '@/lib/rate-limit';
import type { SavedContract } from '@/lib/sample-contract';

export const maxDuration = 60;

const MAX_PER_OWNER = 30;
const dbConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

type Row = { id: string; vendor: string; source_name: string; items: SavedContract['items']; created_at: string };
const toContract = (r: Row): SavedContract => ({ id: r.id, vendor: r.vendor, name: r.source_name, items: r.items, createdAt: r.created_at });

export type ContractsResponse = { storage: 'database' | 'browser'; contracts: SavedContract[] };

// GET: which store is in use, and the saved contracts if it is the database.
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get('owner');
  if (!validOwner(owner)) return NextResponse.json({ error: 'Missing owner.' }, { status: 400 });
  if (!dbConfigured()) return NextResponse.json({ storage: 'browser', contracts: [] } satisfies ContractsResponse);
  const { data, error } = await createAdminClient().from('rateguard_contracts').select('id,vendor,source_name,items,created_at').eq('owner', owner).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ storage: 'browser', contracts: [] } satisfies ContractsResponse); // table not created yet
  return NextResponse.json({ storage: 'database', contracts: (data as Row[]).map(toContract) } satisfies ContractsResponse);
}

const PostBody = z.object({ owner: z.string(), name: z.string().min(1).max(200), text: z.string().min(20).max(60_000), vendor: z.string().max(300).optional() });

// POST: extract the contract once. Saved here when the database is available; otherwise returned for the browser to keep.
export async function POST(req: Request) {
  if (limited(req, 10)) return NextResponse.json({ error: 'Too many uploads. Please wait a few minutes and try again.' }, { status: 429 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !validOwner(parsed.data.owner)) return NextResponse.json({ error: 'Send the contract as text (up to 60,000 characters).' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'The server has no OpenAI key configured.' }, { status: 503 });
  const { owner, name, text, vendor: vendorOverride } = parsed.data;

  let out;
  try {
    out = await extractContract(text);
  } catch (e) {
    console.error('rateguard contract extract failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not read the contract. Check it is the right file and try again.' }, { status: 502 });
  }
  if (!out.items.length) return NextResponse.json({ error: 'No rate card was found in this contract.' }, { status: 422 });
  const vendor = vendorOverride?.trim() || out.vendor;
  if (!vendor) return NextResponse.json({ error: 'The vendor name could not be found in the contract. Enter it and upload again.', needVendor: true }, { status: 422 });

  const draft: SavedContract = { id: crypto.randomUUID(), vendor, name, items: out.items, createdAt: new Date().toISOString() };
  if (dbConfigured()) {
    const db = createAdminClient();
    const { count, error: cErr } = await db.from('rateguard_contracts').select('id', { count: 'exact', head: true }).eq('owner', owner);
    if (!cErr) {
      if ((count ?? 0) >= MAX_PER_OWNER) return NextResponse.json({ error: `You can save up to ${MAX_PER_OWNER} contracts. Delete one first.` }, { status: 409 });
      const { data, error } = await db.from('rateguard_contracts').insert({ owner, vendor, source_name: name, items: out.items }).select('id,vendor,source_name,items,created_at').single();
      if (!error && data) return NextResponse.json({ storage: 'database', contract: toContract(data as Row) });
    }
  }
  return NextResponse.json({ storage: 'browser', contract: draft });
}

export async function DELETE(req: Request) {
  const sp = new URL(req.url).searchParams;
  const owner = sp.get('owner');
  const id = sp.get('id');
  if (!validOwner(owner) || !id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (dbConfigured()) await createAdminClient().from('rateguard_contracts').delete().eq('owner', owner).eq('id', id);
  return NextResponse.json({ ok: true });
}
