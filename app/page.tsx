import SiteHeader from '@/components/SiteHeader';
import RateChecker from '@/components/RateChecker';

const STEPS = [
  ['Save each contract once', 'Upload a vendor contract on the Contracts page. RateGuard reads the vendor and the rate card (item, unit, agreed rate, currency, validity dates, clause) and keeps them. A sample contract is always there.'],
  ['Drop an invoice', 'PDF or text. RateGuard reads it, finds the saved contract for that vendor and fuzzy-matches every line to a contract rate valid on the invoice date.'],
  ['Get a clear verdict', '“Correct, OK to pay”, “Hold, ₹X overbilled” with the clause cited for each line, or “Possible duplicate” (same vendor, invoice number and amount).'],
  ['Raise the dispute in one click', 'Get a ready-to-send email to the vendor that cites every mismatch and clause.']
];

const FLAGS = [
  ['Rate drift', 'The billed rate is higher than the agreed rate on the date of the invoice.'],
  ['Not in contract', 'The line matches nothing on the rate card, so it was never agreed.'],
  ['Expired rate', 'The only matching rate had run out before the invoice date.']
];

const H2 = 'text-[34px] font-extrabold leading-[1.05] tracking-[-1.5px] text-[#0B1F4D] sm:text-[48px]';

export default function Landing() {
  return (
    <div className="overflow-x-clip bg-white text-ink">
      <div className="bg-gradient-to-b from-[#EEF3FF] to-white">
        <SiteHeader />

        <section className="mx-auto max-w-[1240px] px-6 pb-10 pt-12 sm:px-8 sm:pt-16">
          <p className="text-[18px] font-bold uppercase tracking-wide text-[#2563EB]">Contract rate compliance for accounts payable</p>
          <h1 className="mt-4 max-w-4xl text-[44px] font-extrabold leading-[1.02] tracking-[-2px] text-[#0B1F4D] sm:text-[60px] lg:text-[72px]">Catch vendor overbilling before you pay.</h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-[1.6] text-ink-700 sm:text-[20px]">
            Vendors quietly bill above the rates in the contract, and nobody compares every invoice line to the rate card. Save a contract once, then drop each invoice. RateGuard says whether it is OK to pay, or what was overbilled, which clause it breaks and how much you can recover before payment.
          </p>
        </section>

        <section aria-label="Check an invoice" className="mx-auto max-w-[1240px] px-6 pb-16 sm:px-8">
          <RateChecker />
        </section>
      </div>

      <section id="how" aria-labelledby="howh" className="mx-auto max-w-[1240px] px-6 py-16 sm:px-8">
        <h2 id="howh" className={`mb-10 ${H2}`}>How it works</h2>
        <ol className="grid gap-6 md:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-3 rounded-3xl bg-[#EEF3FF] p-8">
              <span className="self-start rounded-full bg-[#1D4ED8] px-4 py-1 text-lg font-extrabold uppercase tracking-wide text-white">Step {i + 1}</span>
              <span className="text-[26px] font-extrabold leading-[1.1] text-[#0B1F4D]">{t}</span>
              <span className="text-[17px] leading-[1.6] text-ink-700">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="flagsh" className="bg-[#EEF3FF]">
        <div className="mx-auto max-w-[1240px] px-6 py-16 sm:px-8">
          <h2 id="flagsh" className={`mb-10 ${H2}`}>What gets flagged</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {FLAGS.map(([t, d]) => (
              <div key={t} className="flex flex-col gap-3 rounded-3xl bg-white p-8 shadow-[0_12px_32px_rgba(11,31,77,0.10)]">
                <span className="text-[26px] font-extrabold text-[#0B1F4D]">{t}</span>
                <span className="text-[17px] leading-[1.6] text-ink-700">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-[1240px] px-6 py-8 text-base text-ink-500 sm:px-8">
        RateGuard. Catch vendor overbilling before you pay. Built on the InvoiceGuard template.
      </footer>
    </div>
  );
}
