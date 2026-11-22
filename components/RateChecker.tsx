'use client';

import { useEffect, useRef, useState } from 'react';
import { rupees } from '@/lib/format';
import { draftDisputeEmail, STATUS_LABEL, type Status } from '@/lib/rateguard';
import type { CheckResponse } from '@/app/api/check/route';

const MAX_PDF_PAGES = 30;
const SAMPLE_INVOICES = [
  { name: 'invoice-clean.txt', url: '/samples/invoice-clean.txt' },
  { name: 'invoice-drift.txt', url: '/samples/invoice-drift.txt' },
  { name: 'invoice-duplicate.txt', url: '/samples/invoice-duplicate.txt' }
];

async function readDocument(file: File): Promise<string> {
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
    let doc;
    try {
      // isEvalSupported: false closes CVE-2024-4367 (font code run through eval in pdf.js before 4.2.67)
      doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    } catch {
      throw new Error(`${file.name} could not be opened. It may be damaged or password protected.`);
    }
    if (doc.numPages > MAX_PDF_PAGES) throw new Error(`${file.name} has ${doc.numPages} pages. The limit is ${MAX_PDF_PAGES}.`);
    let out = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      for (const it of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        if (typeof it.str !== 'string') continue;
        out += it.str + (it.hasEOL ? '\n' : ' ');
      }
      out += '\n';
    }
    if (out.replace(/\s/g, '').length < 40) throw new Error(`${file.name} looks scanned. Please upload a text-based PDF or a text file.`);
    return out;
  }
  const text = await file.text();
  if (text.trim().length < 20) throw new Error(`${file.name} is empty or too short to read.`);
  return text;
}

const BADGE: Record<Status, string> = {
  ok: 'bg-low-bg text-low-fg',
  rate_drift: 'bg-high-bg text-high-fg',
  not_in_contract: 'bg-high-bg text-high-fg',
  expired_rate: 'bg-med-bg text-med-fg'
};
const BTN = 'inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60';

function FilePick({ label, hint, file, onFile }: { label: string; hint: string; file: File | null; onFile: (f: File | null) => void }) {
  const id = label.replace(/\W/g, '').toLowerCase();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-bold text-navy">{label}</label>
      <input
        id={id}
        type="file"
        accept=".pdf,.txt,.text,.md,.csv,application/pdf,text/plain"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="block w-full rounded-lg border-2 border-dashed border-line-input bg-white p-3 text-base text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-white"
      />
      <p className="text-sm text-ink-500">{file ? file.name : hint}</p>
    </div>
  );
}

function Dispute({ result }: { result: CheckResponse['results'][number] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const email = draftDisputeEmail(result);

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
            <label htmlFor={`mail-${result.key}`} className="text-sm font-bold text-navy">Draft to vendor</label>
            <span className="rounded-full bg-med-bg px-3 py-1 text-sm font-bold text-med-fg">Email sending mocked</span>
          </div>
          <textarea ref={area} id={`mail-${result.key}`} readOnly value={email} rows={Math.min(24, email.split('\n').length + 1)} className="w-full resize-y rounded-lg border border-line-input bg-white p-3 font-mono text-sm text-ink" />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={copy} className={`${BTN} min-h-11 bg-accent text-white hover:bg-accent-dark`}>Copy email</button>
            <span role="status" className="text-sm font-semibold text-low-fg">{copied ? 'Copied' : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicePanel({ r }: { r: CheckResponse['results'][number] }) {
  const flagged = r.lines.some((l) => l.status !== 'ok');
  return (
    <section aria-label={`Invoice ${r.invoice.invoiceNumber}`} className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(11,31,77,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-navy">{r.invoice.vendor}</h3>
          <p className="text-base text-ink-700">
            Invoice <span className="font-mono">{r.invoice.invoiceNumber || '—'}</span> · {r.invoice.date ?? 'no date'} · {rupees(r.amount)} · <span className="text-ink-500">{r.name}</span>
          </p>
        </div>
        <p className={`rounded-full px-4 py-1.5 text-base font-bold ${r.recoverable > 0 ? 'bg-high-bg text-high-fg' : 'bg-low-bg text-low-fg'}`}>
          {r.recoverable > 0 ? `${rupees(r.recoverable)} overbilled` : 'No overbilling'}
        </p>
      </div>

      {r.duplicate && (
        <p role="alert" className="mt-4 rounded-lg border-l-4 border-med-fg bg-med-bg px-4 py-3 text-base text-med-fg">
          <strong>Possible duplicate.</strong> Same vendor, invoice number and amount ({rupees(r.amount)}) as an invoice already checked ({r.duplicate.source}). Confirm it was not already paid.
        </p>
      )}

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

      {flagged ? <Dispute result={r} /> : <p className="mt-4 text-base font-semibold text-low-fg">Every line is at or below the contract rate.</p>}
    </section>
  );
}

export default function RateChecker() {
  const [contract, setContract] = useState<File | null>(null);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [busy, setBusy] = useState<null | 'check' | 'sample'>(null);
  const [error, setError] = useState('');
  const [data, setData] = useState<CheckResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function post(payload: object) {
    const res = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? 'Something went wrong. Please try again.');
    return json as CheckResponse;
  }

  async function run(kind: 'check' | 'sample') {
    setBusy(kind);
    setError('');
    setData(null);
    try {
      let json: CheckResponse;
      if (kind === 'sample') {
        const [c, ...inv] = await Promise.all(['/samples/contract.txt', ...SAMPLE_INVOICES.map((s) => s.url)].map(async (u) => {
          const r = await fetch(u);
          if (!r.ok) throw new Error('Could not load the sample files.');
          return r.text();
        }));
        json = await post({ contractText: c, invoices: SAMPLE_INVOICES.map((s, i) => ({ name: s.name, text: inv[i] })), sample: true });
      } else {
        if (!contract || !invoice) throw new Error('Choose both a contract and an invoice.');
        const [c, i] = await Promise.all([readDocument(contract), readDocument(invoice)]);
        json = await post({ contractText: c, invoices: [{ name: invoice.name, text: i }], history });
        setHistory((h) => [...h, ...json.results.map((r) => r.key)]);
      }
      setData(json);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  // /?sample=1 runs the sample straight away
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sample') === '1') void run('sample');
  }, []);

  const sum = (k: 'rate_drift' | 'not_in_contract' | 'expired_rate') => data?.results.reduce((s, r) => s + r.breakdown[k], 0) ?? 0;

  return (
    <div id="check" className="scroll-mt-6">
      <div className="rounded-3xl bg-white p-6 shadow-[0_12px_32px_rgba(11,31,77,0.12)] sm:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <FilePick label="1. Contract" hint="PDF or text file with the rate card" file={contract} onFile={setContract} />
          <FilePick label="2. Invoice" hint="PDF or text file, one invoice" file={invoice} onFile={setInvoice} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy !== null || !contract || !invoice} onClick={() => run('check')} className={`${BTN} bg-accent text-white hover:bg-accent-dark`}>
            {busy === 'check' ? 'Checking…' : 'Check rates'}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => run('sample')} className={`${BTN} border-2 border-accent bg-white text-accent hover:bg-[#EEF3FF]`}>
            {busy === 'sample' ? 'Running sample…' : 'Try with sample data'}
          </button>
          <span className="text-sm text-ink-500">No login needed. Files are read in your browser and sent as text for the check; they are not stored.</span>
        </div>
        <div role="status" aria-live="polite" className="mt-3 text-base text-ink-700">{busy ? 'Reading the documents and checking every line. This takes about 10 to 20 seconds.' : ''}</div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-high-row px-4 py-3 text-base font-semibold text-high-fg">{error}</p>}
      </div>

      <div ref={resultsRef} className="scroll-mt-4">
        {data && (
          <div className="mt-8 flex flex-col gap-6">
            <div className="rounded-3xl bg-navy p-6 text-white sm:p-8">
              <p className="text-lg font-semibold text-[#C9D2E3]">Recoverable before payment</p>
              <p className="text-[44px] font-extrabold leading-tight tracking-tight sm:text-[64px]" aria-label={`Recoverable before payment: ${rupees(data.recoverable)}`}>
                {rupees(data.recoverable)}
              </p>
              <p className="mt-1 text-base text-[#C9D2E3]">
                Rate drift {rupees(sum('rate_drift'))} · Not in contract {rupees(sum('not_in_contract'))} · Expired rate {rupees(sum('expired_rate'))}
                {data.results.length > 1 ? ` · across ${data.results.length} invoices` : ''}
              </p>
              <p className="mt-1 text-sm text-[#C9D2E3]">Rate card read from the contract: {data.rateCard.length} rates. Duplicate memory: {data.duplicateStore}.</p>
            </div>
            {data.results.map((r, i) => <InvoicePanel key={`${r.key}-${i}`} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
