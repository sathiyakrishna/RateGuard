'use client';

import { useEffect, useState } from 'react';
import { addContract, loadLibrary, removeContract, type Library } from '@/lib/contract-store';
import { readDocument } from '@/lib/read-document';
import { rupees } from '@/lib/format';

const BTN = 'inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60';
const INPUT = 'block w-full rounded-lg border border-line-input bg-white px-3 py-3 text-base text-ink';

export default function ContractsManager() {
  const [lib, setLib] = useState<Library | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [vendor, setVendor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inputKey, setInputKey] = useState(0); // changing it clears the file input

  useEffect(() => {
    loadLibrary().then(setLib);
    const v = new URLSearchParams(window.location.search).get('vendor');
    if (v) setVendor(v.slice(0, 300)); // from the "Add contract" link on a "no contract on file" result
  }, []);

  async function save() {
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const text = await readDocument(file);
      const { contract } = await addContract(file.name, text, vendor);
      setLib(await loadLibrary());
      setNotice(`Saved ${contract.vendor} with ${contract.items.length} rates.`);
      setFile(null);
      setVendor('');
      setInputKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the contract.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!lib || !window.confirm(`Delete the contract for ${name}?`)) return;
    await removeContract(id, lib.storage);
    setLib(await loadLibrary());
  }

  return (
    <div className="flex flex-col gap-8">
      <section id="add" aria-labelledby="addh" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-[0_12px_32px_rgba(11,31,77,0.12)] sm:p-8">
        <h2 id="addh" className="text-2xl font-extrabold text-navy">Add a contract</h2>
        <p className="mt-1 text-base text-ink-700">Upload it once. RateGuard reads the vendor and the rate card (item, unit, rate, dates, clause) and keeps them, so you only drop invoices from then on.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="contract-file" className="text-base font-bold text-navy">Contract (PDF or text)</label>
            <input key={inputKey} id="contract-file" type="file" accept=".pdf,.txt,.text,.md,application/pdf,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border-2 border-dashed border-line-input bg-white p-3 text-base file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-white" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="contract-vendor" className="text-base font-bold text-navy">Vendor name <span className="font-normal text-ink-500">(optional)</span></label>
            <input id="contract-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={300} placeholder="Read from the contract if left blank" className={INPUT} />
            <p className="text-sm text-ink-500">Invoices are matched to this contract by vendor name, so use the name as it appears on invoices.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={!file || busy} className={`${BTN} bg-accent text-white hover:bg-accent-dark`}>{busy ? 'Reading contract…' : 'Save contract'}</button>
          <span role="status" aria-live="polite" className="text-base font-semibold text-low-fg">{notice}</span>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-high-row px-4 py-3 text-base font-semibold text-high-fg">{error}</p>}
      </section>

      <section aria-labelledby="listh">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="listh" className="text-2xl font-extrabold text-navy">Saved contracts</h2>
          {lib && <p className="text-sm text-ink-500">{lib.storage === 'database' ? 'Stored in the database (private to this browser).' : 'Stored in this browser only. Clearing site data removes them.'}</p>}
        </div>
        {!lib ? (
          <p className="text-base text-ink-500">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {lib.contracts.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-navy">
                      {c.vendor} {c.sample && <span className="ml-2 rounded-full bg-accent-soft px-3 py-0.5 text-sm font-bold text-accent-text">Sample</span>}
                    </h3>
                    <p className="text-sm text-ink-500">{c.name} · {c.items.length} rates</p>
                  </div>
                  {!c.sample && <button type="button" onClick={() => remove(c.id, c.vendor)} className={`${BTN} min-h-10 border border-high-fg bg-white px-4 text-high-fg hover:bg-high-row`}>Delete</button>}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-base font-semibold text-accent">View rate card</summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
                      <caption className="sr-only">Rate card for {c.vendor}</caption>
                      <thead>
                        <tr className="border-b-2 border-line text-sm uppercase tracking-wide text-ink-500">
                          <th scope="col" className="py-2 pr-3">Item</th>
                          <th scope="col" className="px-3 py-2">Unit</th>
                          <th scope="col" className="px-3 py-2 text-right">Agreed rate</th>
                          <th scope="col" className="px-3 py-2">Valid</th>
                          <th scope="col" className="py-2 pl-3">Clause</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.items.map((it, i) => (
                          <tr key={i} className="border-b border-line-soft">
                            <th scope="row" className="py-2 pr-3 font-semibold">{it.item}</th>
                            <td className="px-3 py-2">{it.unit ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{it.currency === 'INR' ? rupees(it.rate) : `${it.currency} ${it.rate}`}</td>
                            <td className="px-3 py-2 font-mono text-sm">{it.validFrom ?? '…'} to {it.validTo ?? '…'}</td>
                            <td className="py-2 pl-3 font-mono">{it.clause ? `cl. ${it.clause}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
