// RateGuard core: match invoice lines to the contract rate card and flag overbilling.
// Pure functions only (no I/O) so they run on the server and in tests.

export type ContractItem = {
  item: string;
  unit: string | null;
  rate: number;
  currency: string;
  validFrom: string | null; // ISO YYYY-MM-DD
  validTo: string | null;
  clause: string | null;
};

export type InvoiceLine = { item: string; quantity: number; rate: number; amount: number };

export type Invoice = {
  vendor: string;
  invoiceNumber: string;
  date: string | null;
  total: number | null;
  lines: InvoiceLine[];
};

export type Status = 'ok' | 'rate_drift' | 'not_in_contract' | 'expired_rate';

export type CheckedLine = InvoiceLine & {
  status: Status;
  agreedRate: number | null;
  clause: string | null;
  contractItem: string | null;
  validFrom: string | null;
  validTo: string | null;
  overbilled: number;
  matchScore: number;
};

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'OK',
  rate_drift: 'Rate drift',
  not_in_contract: 'Not in contract',
  expired_rate: 'Expired rate'
};

export const MATCH_THRESHOLD = 0.6;
const EPS = 0.005;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------- fuzzy matching ----------

const STOP = new Set(['per', 'of', 'and', 'the', 'for', 'a', 'an', 'in', 'on', 'to', 'service', 'services', 'charge', 'charges', 'fee', 'fees', 'monthly', 'rate']);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const tokenMatch = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && 1 - levenshtein(a, b) / Math.max(a.length, b.length) >= 0.8);

/** 0..1 similarity between two item descriptions. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const ma = ta.filter((x) => tb.some((y) => tokenMatch(x, y))).length;
  const mb = tb.filter((y) => ta.some((x) => tokenMatch(x, y))).length;
  return (ma / ta.length + mb / tb.length) / 2;
}

// ---------- rate checks ----------

const inRange = (date: string | null, from: string | null, to: string | null) =>
  !date || ((!from || date >= from) && (!to || date <= to));

export function checkLine(line: InvoiceLine, rateCard: ContractItem[], invoiceDate: string | null): CheckedLine {
  const scored = rateCard.map((c) => ({ c, score: similarity(line.item, c.item) })).sort((x, y) => y.score - x.score);
  const top = scored[0];
  const lineAmount = Number.isFinite(line.amount) ? line.amount : line.quantity * line.rate;

  if (!top || top.score < MATCH_THRESHOLD) {
    return { ...line, status: 'not_in_contract', agreedRate: null, clause: null, contractItem: null, validFrom: null, validTo: null, overbilled: round2(lineAmount), matchScore: top?.score ?? 0 };
  }

  // the same item can appear several times with different validity windows
  const candidates = scored.filter((s) => s.score >= top.score - 0.05).map((s) => s.c);
  const valid = candidates.filter((c) => inRange(invoiceDate, c.validFrom, c.validTo));
  const expired = valid.length === 0;
  const pick = expired
    ? [...candidates].sort((a, b) => (b.validTo ?? '9999').localeCompare(a.validTo ?? '9999'))[0]
    : [...valid].sort((a, b) => (b.validFrom ?? '').localeCompare(a.validFrom ?? ''))[0];

  const excess = Math.max(0, (line.rate - pick.rate) * line.quantity);
  const status: Status = expired ? 'expired_rate' : line.rate > pick.rate + EPS ? 'rate_drift' : 'ok';
  return {
    ...line,
    status,
    agreedRate: pick.rate,
    clause: pick.clause,
    contractItem: pick.item,
    validFrom: pick.validFrom,
    validTo: pick.validTo,
    overbilled: status === 'ok' ? 0 : round2(excess),
    matchScore: top.score
  };
}

export type InvoiceResult = {
  invoice: Invoice;
  lines: CheckedLine[];
  recoverable: number;
  breakdown: Record<Exclude<Status, 'ok'>, number>;
  counts: Record<Status, number>;
};

export function checkInvoice(invoice: Invoice, rateCard: ContractItem[]): InvoiceResult {
  const lines = invoice.lines.map((l) => checkLine(l, rateCard, invoice.date));
  const breakdown = { rate_drift: 0, not_in_contract: 0, expired_rate: 0 };
  const counts: Record<Status, number> = { ok: 0, rate_drift: 0, not_in_contract: 0, expired_rate: 0 };
  for (const l of lines) {
    counts[l.status]++;
    if (l.status !== 'ok') breakdown[l.status] += l.overbilled;
  }
  const b = { rate_drift: round2(breakdown.rate_drift), not_in_contract: round2(breakdown.not_in_contract), expired_rate: round2(breakdown.expired_rate) };
  return { invoice, lines, breakdown: b, counts, recoverable: round2(b.rate_drift + b.not_in_contract + b.expired_rate) };
}

// ---------- duplicate check (secondary): vendor + invoice number + amount ----------

const VENDOR_NOISE = new Set(['pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'co', 'company', 'corp', 'the']);

export function invoiceAmount(inv: Invoice): number {
  return round2(inv.total != null && Number.isFinite(inv.total) ? inv.total : inv.lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : l.quantity * l.rate), 0));
}

export function duplicateKey(inv: Invoice): string {
  const vendor = inv.vendor.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t && !VENDOR_NOISE.has(t)).join(' ');
  const number = inv.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${vendor}|${number}|${invoiceAmount(inv).toFixed(2)}`;
}

// ---------- dispute email (template, no model call: every figure comes from the check) ----------

const money = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function draftDisputeEmail(r: InvoiceResult): string {
  const flagged = r.lines.filter((l) => l.status !== 'ok');
  const { invoice } = r;
  const items = flagged.map((l, i) => {
    const clause = l.clause ? `clause ${l.clause}` : 'the contract';
    const qty = `qty ${l.quantity}`;
    if (l.status === 'not_in_contract') {
      return `${i + 1}. ${l.item} (${qty}, billed at ${money(l.rate)}, ${money(l.amount)}): this item does not appear in the contract rate card. Please share the approval or purchase order that covers it, or withdraw the charge.`;
    }
    if (l.status === 'expired_rate') {
      const to = l.validTo ? ` expired on ${l.validTo}` : ' is no longer valid';
      return `${i + 1}. ${l.item} (${qty}): billed at ${money(l.rate)}. The rate in ${clause} (${money(l.agreedRate ?? 0)})${to}, before the invoice date. Please confirm the currently agreed rate. Amount in question: ${money(l.overbilled)}.`;
    }
    return `${i + 1}. ${l.item} (${qty}): billed at ${money(l.rate)} against the agreed ${money(l.agreedRate ?? 0)} in ${clause}. Overbilled by ${money(l.overbilled)}.`;
  });
  return [
    `Subject: Invoice ${invoice.invoiceNumber}: billing discrepancies against the contract rate card`,
    '',
    `Dear ${invoice.vendor} accounts team,`,
    '',
    `We reviewed invoice ${invoice.invoiceNumber}${invoice.date ? ` dated ${invoice.date}` : ''} against our contract. ${flagged.length === 1 ? 'One line does' : `${flagged.length} lines do`} not match the agreed terms:`,
    '',
    ...items,
    '',
    `Total in dispute: ${money(r.recoverable)}.`,
    '',
    'Please send a revised invoice or a credit note for this amount. We are holding payment of the disputed portion until then.',
    '',
    'Regards,',
    '[Your name]',
    'Accounts Payable'
  ].join('\n');
}
