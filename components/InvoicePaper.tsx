import { rupees } from '@/lib/format';
import { STATUS_LABEL, type CheckedLine, type Status } from '@/lib/rateguard';
import type { CheckResponse } from '@/app/api/check/route';
import './visuals.css';

/* The checked invoice drawn as a paper invoice. Flagged lines are highlighted with a callout to the side
   (below the line on phones): agreed rate, billed rate, overbilled amount, clause. Clean lines get a green tick.
   Decorative: the detail table under it carries the same facts, so this is hidden from screen readers. */

type Flag = Exclude<Status, 'ok'>;

const TONE: Record<Flag, { row: string; box: string; text: string; dot: string }> = {
  rate_drift: { row: 'bg-[#FFF4D6]', box: 'border-[#F79009] bg-[#FEF0C7]', text: 'text-[#93370D]', dot: 'bg-[#F79009]' },
  expired_rate: { row: 'bg-[#FFF4D6]', box: 'border-[#F79009] bg-[#FEF0C7]', text: 'text-[#93370D]', dot: 'bg-[#F79009]' },
  not_in_contract: { row: 'bg-high-row', box: 'border-[#F04438] bg-high-bg', text: 'text-high-fg', dot: 'bg-[#D92D20]' }
};

const STAMP = 'rg-stamp pointer-events-none absolute right-0 top-2 rounded-md border-[5px] bg-white/60 px-4 py-1 text-[26px] font-black uppercase tracking-[0.18em] sm:right-4 sm:text-[34px]';

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" stroke="#067647" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#DCFAE6" stroke="none" />
      <path d="M5.5 10.5l3 3 6-6.5" />
    </svg>
  );
}

function Callout({ l, status }: { l: CheckedLine; status: Flag }) {
  const t = TONE[status];
  return (
    <div className={`mt-2 rounded-lg border-l-4 px-3 py-2 text-[13px] leading-snug md:absolute md:left-full md:top-1/2 md:ml-6 md:mt-0 md:w-[300px] md:-translate-y-1/2 md:shadow-[0_6px_18px_rgba(11,31,77,0.12)] ${t.box} ${t.text}`}>
      <span aria-hidden="true" className="absolute -left-6 top-1/2 hidden h-px w-6 bg-current opacity-60 md:block" />
      <p className="font-extrabold">{STATUS_LABEL[status]}{l.clause ? ` · Clause ${l.clause}` : ''}</p>
      {l.agreedRate != null ? (
        <p className="font-mono text-[12px]">Agreed {rupees(l.agreedRate)} · Billed {rupees(l.rate)}</p>
      ) : (
        <p className="font-mono text-[12px]">Billed {rupees(l.rate)} · no agreed rate</p>
      )}
      <p className="font-extrabold">Overbilled {rupees(l.overbilled)}</p>
    </div>
  );
}

type Row = { item: string; quantity: number; rate: number; amount: number; status: Status | null; checked: CheckedLine | null };

export default function InvoicePaper({ d, ok }: { d: CheckResponse; ok: boolean }) {
  const rows: Row[] = d.result
    ? d.result.lines.map((l) => ({ item: l.item, quantity: l.quantity, rate: l.rate, amount: l.amount, status: l.status, checked: l }))
    : d.invoice.lines.map((l) => ({ ...l, status: null, checked: null }));
  const anyFlag = rows.some((r) => r.status != null && r.status !== 'ok');

  return (
    <div aria-hidden="true" className={`relative ${anyFlag ? 'md:pr-[336px]' : ''}`}>
      <div className="rg-paper relative rounded-md border border-line px-4 pb-6 pt-5 shadow-[0_14px_34px_rgba(11,31,77,0.14)] sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#0B1F4D] pb-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight text-[#0B1F4D] sm:text-xl">{d.invoice.vendor}</p>
            <p className="text-[13px] uppercase tracking-widest text-ink-500">Tax invoice</p>
          </div>
          <div className="text-right font-mono text-[13px] text-ink-700">
            <p>No. {d.invoice.invoiceNumber || '—'}</p>
            <p>{d.invoice.date ?? 'No date'}</p>
          </div>
        </div>

        <div className="mt-2 hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 border-b border-line pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-500 sm:grid">
          <span>Description</span>
          <span className="text-right">Qty × rate</span>
          <span className="w-32 text-right">Amount</span>
        </div>

        <ul>
          {rows.map((r, i) => {
            const flag = r.status != null && r.status !== 'ok' ? (r.status as Flag) : null;
            const tone = flag ? TONE[flag] : null;
            return (
              <li key={i} className={`relative my-1 flex flex-col justify-center rounded px-1 py-1.5 ${flag ? 'md:min-h-[96px]' : ''} ${tone ? `${tone.row} rg-flash` : ''}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-[14px] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-6 sm:text-[15px]">
                  <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {r.status === 'ok' && <Tick />}
                      {tone && <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-extrabold leading-none text-white ${tone.dot}`}>!</span>}
                    </span>
                    <span className={`min-w-0 break-words ${flag ? 'font-bold' : ''}`}>{r.item}</span>
                  </span>
                  <span className="whitespace-nowrap pl-7 text-left font-mono text-[13px] sm:pl-0 sm:text-right">{r.quantity} × {rupees(r.rate)}</span>
                  <span className={`whitespace-nowrap text-right font-mono sm:w-32 ${flag ? 'font-bold' : ''}`}>{rupees(r.amount)}</span>
                </div>
                {flag && r.checked && <Callout l={r.checked} status={flag} />}
              </li>
            );
          })}
        </ul>

        {(d.duplicate || ok) && (
          <div className="relative h-20 sm:h-24">
            {d.duplicate ? (
              <div className={`${STAMP} border-[#B54708] text-[#B54708]`}>Duplicate</div>
            ) : (
              <div className={`${STAMP} border-[#067647] text-[#067647]`}>OK to pay</div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-baseline justify-between gap-4 border-t-2 border-[#0B1F4D] pt-3">
          <span className="text-[13px] font-bold uppercase tracking-wide text-ink-500">Total (before GST)</span>
          <span className="font-mono text-xl font-extrabold text-[#0B1F4D]">{rupees(d.amount)}</span>
        </div>
      </div>
    </div>
  );
}
