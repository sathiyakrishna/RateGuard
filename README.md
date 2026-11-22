# RateGuard

**Catch vendor overbilling before you pay.**

## Problem

Vendors often bill above the rates agreed in the contract: a rate that crept up, a service nobody approved, a price that expired months ago. Accounts payable teams rarely compare every invoice line to the contract rate card, so the overbilling is paid and then has to be chased, if it is noticed at all.

## How it works

1. Open the home page (no login). Upload a **contract** and an **invoice** as PDF or text, or press **Try with sample data**.
2. OpenAI (`gpt-4o-mini` by default, set `OPENAI_MODEL` to change) extracts the contract rate card (item, unit, agreed rate, currency, valid from/to, clause reference) and the invoice (vendor, number, date, and per line: item, quantity, billed rate, amount). The model only extracts. All checking is plain code.
3. Each invoice line is fuzzy-matched to a rate card item (token overlap with typo tolerance, threshold 0.6). If an item has several rates for different periods, the one valid on the invoice date is used. Each line gets one status:
   - **Rate drift**: billed rate is higher than the agreed rate.
   - **Not in contract**: no rate card item matches. The full line amount is counted as disputable.
   - **Expired rate**: the only matching rate had expired before the invoice date.
4. The page shows a table (item, agreed rate, billed rate, quantity, overbilled amount, clause cited, status) under a total: **Recoverable before payment: ₹X**.
5. **Duplicate check (secondary)**: same vendor + invoice number + amount (case, punctuation and "Pvt Ltd" differences ignored). It is shown as a warning and is not added to the recoverable total.
6. **Raise dispute** drafts an email to the vendor citing every mismatch and its clause, in a copyable box labelled "Email sending mocked".

The sample button runs the three sample invoices against the sample contract: one clean, one with rate drift on 2 lines (₹32,000 recoverable), and one resubmission of the clean invoice (flagged as a possible duplicate).

Run it locally:

```bash
npm install
cp .env.example .env.local   # set OPENAI_API_KEY (Supabase values are optional for RateGuard)
npm run dev                  # http://localhost:3000
npm test
```

Sample files are in `public/samples/` (`contract.txt`, `invoice-clean.txt`, `invoice-drift.txt`, `invoice-duplicate.txt`). Open `/?sample=1` to run the sample on load.

Main code: `lib/rateguard.ts` (matching, checks, dispute email), `lib/rateguard-ai.ts` (OpenAI extraction), `app/api/check/route.ts` (the check API), `components/RateChecker.tsx` (the page flow).

## Built on

The [InvoiceGuard](https://github.com/sathiyakrishna/Rateguard) template: a Next.js 14 + Supabase app that finds duplicate invoices in an SAP payment-run register. RateGuard reuses its stack, styling, PDF.js setup, OpenAI call pattern and Supabase admin client. The InvoiceGuard login-based pages (`/queue`, `/upload`, `/dashboard`, `/settings`) are still in the repo but are not part of the RateGuard flow.

## Built today

22 Nov, 1 PM to 5 PM.

## What's mocked

- **Email sending**: the dispute email is only drafted for copying. Nothing is sent.
- **Duplicate memory**: with Supabase configured and migration `supabase/migrations/009_rateguard_invoices.sql` applied, checked invoices are remembered across sessions. Otherwise duplicates are only caught within the open page. Sample runs never write to the database.
- **Currency**: amounts are shown in ₹. The extracted currency is kept but no conversion is done.
- **Sample data**: the vendor, contract and invoices are invented.
- **Not covered**: scanned (image-only) PDFs, taxes and discounts, unit-of-measure conversion, and multi-page invoice bundles.

## Tools used

Next.js 14, React 18, TypeScript, Tailwind CSS, OpenAI Chat Completions API, Zod, PDF.js (`pdfjs-dist`), Supabase (optional), Vitest, Claude Code.
