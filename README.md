# RateGuard

**Catch vendor overbilling before you pay.**

## Problem

Vendors often bill above the rates agreed in the contract: a rate that crept up, a service nobody approved, a price that expired months ago. Accounts payable teams rarely compare every invoice line to the contract rate card, so the overbilling is paid and then has to be chased, if it is noticed at all.

## How it works

1. **Contracts** (nav link, `/contracts`): upload a vendor contract once (PDF or text). OpenAI extracts the vendor name and the rate card (item, unit, agreed rate, currency, valid from/to, clause reference), and it is saved. Saved in Supabase when configured (table `rateguard_contracts`, migration `010`), otherwise in the browser's localStorage. A sample contract (Apex Facility Services) is always present.
2. **Check an invoice** (home page, no login): drop an invoice, PDF or text. OpenAI extracts the vendor, invoice number, date and lines (item, quantity, billed rate, amount). The vendor is matched to a saved contract by name (company suffixes and punctuation ignored). The model only extracts. All checking is plain code.
3. Each invoice line is fuzzy-matched to a rate card item (token overlap with typo tolerance, threshold 0.6). If an item has several rates for different periods, the one valid on the invoice date is used. Each line gets one status:
   - **Rate drift**: billed rate is higher than the agreed rate.
   - **Not in contract**: no rate card item matches. The full line amount is counted as disputable.
   - **Expired rate**: the only matching rate had expired before the invoice date.
4. A verdict banner sits at the top:
   - ✅ **Correct, OK to pay**: every line matches and no duplicate was found.
   - ⚠️ **Hold, ₹X overbilled**: rate drift, not-in-contract or expired-rate lines, with the detail table below (item, agreed rate, billed rate, quantity, overbilled amount, clause cited, status).
   - 🔁 **Possible duplicate, check before paying**: same vendor + invoice number + amount (case, punctuation and "Pvt Ltd" differences ignored). Uses Supabase if available, otherwise only invoices already checked in the open page.
   - **No contract on file for this vendor**, with an **Add contract** link.
5. **Raise dispute** (on a Hold) drafts an email to the vendor citing every mismatch and its clause, in a copyable box labelled "Email sending mocked".
6. **Try with sample data** lets you pick one of three sample invoices and checks it against the saved sample contract: clean, rate drift on 2 lines (₹32,000), or the clean invoice resubmitted (flagged as a possible duplicate).

Run it locally:

```bash
npm install
cp .env.example .env.local   # set OPENAI_API_KEY (Supabase values are optional for RateGuard)
npm run dev                  # http://localhost:3000
npm test
```

Sample files are in `public/samples/` (`contract.txt`, `invoice-clean.txt`, `invoice-drift.txt`, `invoice-duplicate.txt`). Open `/?sample=drift` (or `clean`, `duplicate`) to run a sample on load.

Main code: `lib/rateguard.ts` (matching, checks, dispute email), `lib/rateguard-ai.ts` (OpenAI extraction), `lib/contract-store.ts` (contracts library), `app/api/check/route.ts` and `app/api/contracts/route.ts` (APIs), `components/RateChecker.tsx` and `components/ContractsManager.tsx` (the pages).

## Built on

The [InvoiceGuard](https://github.com/sathiyakrishna/Rateguard) template: a Next.js 14 + Supabase app that finds duplicate invoices in an SAP payment-run register. RateGuard reuses its stack, styling, PDF.js setup, OpenAI call pattern and Supabase admin client. The InvoiceGuard login-based pages (`/queue`, `/upload`, `/dashboard`, `/settings`) are still in the repo but are not part of the RateGuard flow.

## Built today

22 Nov, 1 PM to 5 PM.

## What's mocked

- **Email sending**: the dispute email is only drafted for copying. Nothing is sent.
- **Duplicate memory**: with Supabase configured and migration `009` applied, checked invoices are remembered across sessions. Otherwise duplicates are only caught within the open page. Sample runs never write to the database.
- **No login, so no real privacy**: saved contracts and invoice history are scoped to an anonymous id kept in your browser. Anyone with that id can read them. Treat it as a demo, not as access control.
- **Currency**: amounts are shown in ₹. The extracted currency is kept but no conversion is done.
- **Sample data**: the vendor, contract and invoices are invented.
- **Not covered**: scanned (image-only) PDFs, taxes and discounts, unit-of-measure conversion, and multi-page invoice bundles.

## Tools used

Next.js 14, React 18, TypeScript, Tailwind CSS, OpenAI Chat Completions API, Zod, PDF.js (`pdfjs-dist`), Supabase (optional), Vitest, Claude Code.
