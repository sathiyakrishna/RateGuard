// Browser only: the contracts library. Saved in Supabase (through /api/contracts) when the server has it,
// otherwise in this browser's localStorage. The built-in sample contract is always present.
import { SAMPLE_CONTRACT, type SavedContract } from './sample-contract';
import type { ContractsResponse } from '@/app/api/contracts/route';

const OWNER_KEY = 'rg-owner';
const LOCAL_KEY = 'rg-contracts';

export type Library = { storage: 'database' | 'browser'; contracts: SavedContract[] };

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** Anonymous per-browser id. There is no login, so this is what scopes saved contracts and invoice history. */
export function getOwner(): string {
  return safe(() => {
    let id = localStorage.getItem(OWNER_KEY);
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(OWNER_KEY, id);
    }
    return id;
  }, 'anonymous-session');
}

const readLocal = (): SavedContract[] =>
  safe(() => {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw.filter((c) => c && typeof c.id === 'string' && typeof c.vendor === 'string' && Array.isArray(c.items) && c.items.length) as SavedContract[]) : [];
  }, []);

const writeLocal = (list: SavedContract[]) => safe(() => localStorage.setItem(LOCAL_KEY, JSON.stringify(list)), undefined);

export async function loadLibrary(): Promise<Library> {
  let storage: Library['storage'] = 'browser';
  let saved: SavedContract[] = [];
  try {
    const res = await fetch(`/api/contracts?owner=${encodeURIComponent(getOwner())}`);
    if (res.ok) {
      const json = (await res.json()) as ContractsResponse;
      storage = json.storage;
      saved = json.contracts;
    }
  } catch {
    /* offline or no server store: fall back to the browser */
  }
  if (storage === 'browser') saved = readLocal();
  return { storage, contracts: [SAMPLE_CONTRACT, ...saved.filter((c) => c.id !== SAMPLE_CONTRACT.id)] };
}

/** Extracts the contract once (server side, Claude) and saves it. Returns the saved contract. */
export async function addContract(name: string, text: string, vendor?: string): Promise<{ contract: SavedContract; needVendor?: false }> {
  const res = await fetch('/api/contracts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: getOwner(), name, text, vendor: vendor?.trim() || undefined })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.error ?? 'Could not save the contract.'), { needVendor: Boolean(json?.needVendor) });
  if (json.storage === 'browser') writeLocal([json.contract, ...readLocal()]);
  return { contract: json.contract };
}

export async function removeContract(id: string, storage: Library['storage']): Promise<void> {
  if (id === SAMPLE_CONTRACT.id) return;
  if (storage === 'database') await fetch(`/api/contracts?owner=${encodeURIComponent(getOwner())}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  else writeLocal(readLocal().filter((c) => c.id !== id));
}
