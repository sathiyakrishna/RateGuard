'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { rupees } from '@/lib/format';
import { draftDisputeEmail, STATUS_LABEL, type Status } from '@/lib/rateguard';
import { SAMPLE_INVOICES } from '@/lib/sample-contract';
import { getOwner, loadLibrary, type Library } from '@/lib/contract-store';
import { readDocument } from '@/lib/read-document';
import type { CheckResponse } from '@/app/api/check/route';

const BTN = 'inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60';

const BADGE: Record<Status, string> = {
  ok: 'bg-low-bg text-low-fg',
  rate_drift: 'bg-high-bg text-high-fg',
  not_in_contract: 'bg-high-bg text-high-fg',
  expired_rate: 'bg-med-bg text-med-fg'
};

type Verdict = 'no_contract' | 'hold' | 'duplicate' | 'ok';

function verdictOf(d: CheckResponse): Verdict {
  if (!d.result) return 'no_contract';
  if (d.result.lines.some((l) => l.status !== 'ok')) return 'hold';
  return d.duplicate ? 'duplicate' : 'ok';
}

function Banner({ d }: { d: CheckResponse }) {
  const v = verdictOf(d);
  const dupNote = d.duplicate ? ` Also a possible duplicate of ${d.duplicate.of}.` : '';
  const r = d.result;
  const cfg = {
    ok: { icon: '✅', title: 'Correct — OK to pay', sub: `Every line matches the ${d.contract?.vendor} contract and no duplicate was found.`, cls: 'bg-low-bg text-low-fg border-low-fg' },
    hold: {
      icon: '⚠️',
      title: r && r.recoverable > 0 ? `Hold — ${rupees(r.recoverable)} overbilled` : 'Hold — rates need review',
      sub: r ? `Rate drift ${rupees(r.breakdown.rate_drift)} · Not in contract ${rupees(r.breakdown.not_in_contract)} · Expired rate ${rupees(r.breakdown.expired_rate)}.${dupNote}` : '',
      cls: 'bg-high-bg text-high-fg border-high-fg'
    },
    duplicate: { icon: '🔁', title: 'Possible duplicate — check before paying', sub: `Same vendor, invoice number and amount as ${d.duplicate?.of}. The rates themselves match the contract.`, cls: 'bg-med-bg text-med-fg border-med-fg' },
    no_contract: {
      icon: '📄',
      title: 'No contract on file for this vendor',
      sub: `The invoice is from “${d.invoice.vendor}”, which matches none of your saved contracts, so its rates were not checked.${dupNote}`,
      cls: 'bg-accent-soft text-accent-text border-accent'
    }
  }[v];
  return (
    <div className={`rounded-3xl border-l-8 p-6 sm:p-8 ${cfg.cls}`}>
      <p className="flex items-center gap-3 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[44px]">
        <span aria-hidden="true">{cfg.icon}</span>
        <span>{cfg.title}</span>
      </p>
      <p className="mt-2 text-base font-medium sm:text-lg">{cfg.sub}</p>
      {v === 'no_contract' && (
        <Link href={`/contracts?vendor=${encodeURIComponent(d.invoice.vendor)}#add`} className={`${BTN} mt-4 bg-accent text-white hover:bg-accent-dark`}>Add contract</Link>
      )}
    </div>
  );
}

function Dispute({ d }: { d: CheckResponse }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const email = draftDisputeEmail(d.result!);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      area.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${BTN} bg-high-fg text-white hover:bg-[#912018]`}>
        {open ? 'Hide dispute email' : 'Raise dispute'}
      </button>
      {open && (
        <div className="mt-4 rounded-xl border border-line bg-ground p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="dispute-mail" className="text-sm font-bold text-navy">Draft to vendor</label>
            <span className="rounded-full bg-med-bg px-3 py-1 text-sm font-bold text-med-fg">Email sending mocked</span>
          </div>
          <textarea ref={area} id="dispute-mail" readOnly value={email} rows={Math.min(24, email.split('\n').length + 1)} className="w-full resize-y rounded-lg border border-line-input bg-white p-3 font-mono text-sm text-ink" />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={copy} className={`${BTN} min-h-11 bg-accent text-white hover:bg-accent-dark`}>Copy email</button>
            <span role="status" className="text-sm font-semibold text-low-fg">{copied ? 'Copied' : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ d }: { d: CheckResponse }) {
  const r = d.result;
  const head = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-extrabold text-navy">{d.invoice.vendor}</h3>
        <p className="text-base text-ink-700">
          Invoice <span className="font-mono">{d.invoice.invoiceNumber || '—'}</span> · {d.invoice.date ?? 'no date'} · {rupees(d.amount)} · <span className="text-ink-500">{d.name}</span>
        </p>
        {d.contract && <p className="text-sm text-ink-500">Checked against the {d.contract.vendor} contract ({d.contract.rates} rates).</p>}
      </div>
    </div>
  );

  if (!r) {
    return (
      <section aria-label="Invoice" className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        {head}
        <p className="mt-3 text-base text-ink-700">{d.invoice.lines.length} line{d.invoice.lines.length === 1 ? '' : 's'} read. Add the vendor’s contract and drop the invoice again to check them.</p>
      </section>
    );
  }

  const flagged = r.lines.some((l) => l.status !== 'ok');
  return (
    <section aria-label={`Invoice ${d.invoice.invoiceNumber}`} className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(11,31,77,0.06)] sm:p-6">
      {head}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-[15px]">
          <caption className="sr-only">Invoice lines checked against the contract rate card</caption>
          <thead>
            <tr className="border-b-2 border-line text-sm uppercase tracking-wide text-ink-500">
              <th scope="col" className="py-2 pr-3">Item</th>
              <th scope="col" className="px-3 py-2 text-right">Agreed rate</th>
              <th scope="col" className="px-3 py-2 text-right">Billed rate</th>
              <th scope="col" className="px-3 py-2 text-right">Qty</th>
              <th scope="col" className="px-3 py-2 text-right">Overbilled</th>
              <th scope="col" className="px-3 py-2">Clause</th>
              <th scope="col" className="py-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l, i) => (
              <tr key={i} className={`border-b border-line-soft align-top ${l.status === 'ok' ? '' : 'bg-high-row'}`}>
                <th scope="row" className="py-3 pr-3 font-semibold text-ink">
                  {l.item}
                  {l.contractItem && l.contractItem !== l.item && <span className="block text-sm font-normal text-ink-500">matched to “{l.contractItem}”</span>}
                </th>
                <td className="px-3 py-3 text-right font-mono">{l.agreedRate == null ? '—' : rupees(l.agreedRate)}</td>
                <td className="px-3 py-3 text-right font-mono">{rupees(l.rate)}</td>
                <td className="px-3 py-3 text-right font-mono">{l.quantity}</td>
                <td className={`px-3 py-3 text-right font-mono ${l.overbilled > 0 ? 'font-bold text-high-fg' : ''}`}>{l.overbilled > 0 ? rupees(l.overbilled) : '—'}</td>
                <td className="px-3 py-3 font-mono">{l.clause ? `cl. ${l.clause}` : '—'}</td>
                <td className="py-3 pl-3"><span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${BADGE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {flagged && <Dispute d={d} />}
    </section>
  );
}

export default function RateChecker() {
  const [lib, setLib] = useState<Library | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<CheckResponse | null>(null);
  const [history, setHistory] = useState<Array<{ key: string; label: string }>>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLibrary().then(setLib);
  }, []);

  async function run(name: string, text: string, opts: { sample?: boolean; seed?: Array<{ name: string; text: string }> } = {}) {
    const library = lib ?? (await loadLibrary());
    if (!lib) setLib(library);
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: { name, text },
        contracts: library.contracts.map((c) => ({ id: c.id, vendor: c.vendor, items: c.items })),
        owner: getOwner(),
        sample: opts.sample,
        seed: opts.seed,
        history
      })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? 'Something went wrong. Please try again.');
    const out = json as CheckResponse;
    if (!opts.sample && out.contract) setHistory((h) => [...h, { key: out.key, label: name }]);
    return out;
  }

  async function guarded(fn: () => Promise<CheckResponse>) {
    setBusy(true);
    setError('');
    setData(null);
    try {
      setData(await fn());
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file || busy) return;
    void guarded(async () => run(file.name, await readDocument(file)));
  };

  const fetchText = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Could not load the sample files.');
    return r.text();
  };

  const runSample = (key: (typeof SAMPLE_INVOICES)[number]['key']) => {
    if (busy) return;
    const pick = SAMPLE_INVOICES.find((s) => s.key === key)!;
    void guarded(async () => {
      const text = await fetchText(pick.url);
      // the duplicate sample is the clean invoice resubmitted, so the clean one counts as already seen
      const seed = key === 'duplicate' ? [{ name: SAMPLE_INVOICES[0].name, text: await fetchText(SAMPLE_INVOICES[0].url) }] : undefined;
      return run(pick.name, text, { sample: true, seed });
    });
  };

  // /?sample=drift (or clean, duplicate; 1 means drift) runs a sample straight away
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('sample');
    if (!s) return;
    const key = SAMPLE_INVOICES.find((x) => x.key === s)?.key ?? 'drift';
    setPickerOpen(true);
    runSample(key);
    // eslint-disable-next-line
  }, []);

  const contracts = lib?.contracts ?? [];
  return (
    <div id="check" className="scroll-mt-6">
      <div className="rounded-3xl bg-white p-6 shadow-[0_12px_32px_rgba(11,31,77,0.12)] sm:p-8">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]); }}
        >
          <input id="invoice-file" type="file" accept=".pdf,.txt,.text,.md,.csv,application/pdf,text/plain" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} className="peer sr-only" />
          <label
            htmlFor="invoice-file"
            className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center peer-focus-visible:ring-4 peer-focus-visible:ring-accent/40 ${dragging ? 'border-accent bg-[#EEF3FF]' : 'border-line-input bg-ground'} ${busy ? 'opacity-60' : ''}`}
          >
            <span className="text-2xl font-extrabold text-navy">{busy ? 'Checking the invoice…' : 'Drop an invoice here'}</span>
            <span className="text-base text-ink-700">{busy ? 'Reading it and checking every line. This takes about 10 seconds.' : 'or click to choose a PDF or text file'}</span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" disabled={busy} aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)} className={`${BTN} border-2 border-accent bg-white text-accent hover:bg-[#EEF3FF]`}>
            Try with sample data
          </button>
          <p className="text-sm text-ink-500">
            {lib ? <>Checking against {contracts.length} saved contract{contracts.length === 1 ? '' : 's'}. </> : null}
            <Link href="/contracts" className="font-semibold text-accent underline">Manage contracts</Link>
          </p>
        </div>

        {pickerOpen && (
          <div className="mt-4 rounded-2xl bg-[#EEF3FF] p-4 sm:p-5">
            <p className="text-base font-bold text-navy">Pick a sample invoice. It is checked against the saved sample contract (Apex Facility Services).</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {SAMPLE_INVOICES.map((s) => (
                <button key={s.key} type="button" disabled={busy} onClick={() => runSample(s.key)} className="rounded-xl border-2 border-accent bg-white p-4 text-left hover:bg-[#F8FAFF] disabled:opacity-60">
                  <span className="block text-lg font-extrabold text-navy">{s.label}</span>
                  <span className="block text-sm text-ink-700">{s.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-sm text-ink-500">No login needed. The invoice is read in your browser and sent as text for the check; it is not stored.</p>
        <div role="status" aria-live="polite" className="sr-only">{busy ? 'Checking the invoice' : ''}</div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-high-row px-4 py-3 text-base font-semibold text-high-fg">{error}</p>}
      </div>

      <div ref={resultsRef} className="scroll-mt-4" aria-live="polite">
        {data && (
          <div className="mt-8 flex flex-col gap-6">
            <Banner d={data} />
            {data.duplicate && data.result && verdictOf(data) === 'hold' && (
              <p role="alert" className="rounded-lg border-l-4 border-med-fg bg-med-bg px-4 py-3 text-base text-med-fg">
                <strong>Possible duplicate.</strong> Same vendor, invoice number and amount ({rupees(data.amount)}) as {data.duplicate.of}. Confirm it was not already paid.
              </p>
            )}
            <Detail d={data} />
            <p className="text-sm text-ink-500">Duplicate memory: {data.duplicateStore}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
