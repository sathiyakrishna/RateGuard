# RateGuard
Catch vendor overbilling before you pay.

**Live:** https://rate-guard.replit.app

## Problem
Vendors often bill above the rates agreed in the contract: a rate that crept up, a service nobody approved, a price that expired months ago. Accounts payable teams rarely compare every invoice line to the contract rate card, so the overbilling is paid and then has to be chased, if it is noticed at all.

## How it works
**Contracts (/contracts):** upload a vendor contract once (PDF or text). Claude extracts the vendor name and rate card (item, unit, agreed rate, currency, valid from/to, clause reference) and saves it. Stored in Supabase when configured, otherwise in browser localStorage.

**Check an invoice (home page, no login):** drop an invoice (PDF or text). Claude extracts the vendor, invoice number, date and line items. The vendor is matched to a saved contract by name. **The model only extracts; all checking is plain code**, so every figure is traceable.

Each invoice line is fuzzy-matched to a rate card item. If an item has several rates for different periods, the one valid on the invoice date is used. Each line gets one status:
- **Rate drift:** billed rate is higher than the agreed rate
- **Not in contract:** no rate card item matches; the full line amount is disputable
- **Expired rate:** the matching rate had expired before the invoice date

**Verdict banner:**
- ✅ **Correct, OK to pay:** every line matches, no duplicate found
- ⚠️ **Hold, ₹X overbilled:** with a detail table (item, agreed rate, billed rate, quantity, overbilled amount, clause, status)
- 🔁 **Possible duplicate, check before paying:** same vendor + invoice number + amount
- 📄 **No contract on file for this vendor:** with an Add contract link

**Raise dispute** (on a Hold) drafts a vendor email citing every mismatch and its clause.

**Try with sample data** checks one of three sample invoices against the sample contract: clean, rate drift on 2 lines (₹32,000), or the clean invoice resubmitted (duplicate).

## What's mocked
- **Email sending:** the dispute email is drafted for copying only. Nothing is sent.
- **Duplicate memory:** without Supabase, duplicates are only caught within the open page. Sample runs never write to the database.
- **No login, so no real privacy:** saved contracts are scoped to an anonymous ID in your browser. Treat it as a demo, not access control.
- **Sample data:** the vendor, contract and invoices are invented.

## Hardcoded values
These are fixed in code today and would be configurable in a production version:
- **Sample contract:** Apex Facility Services, 5 rates with clause numbers, always present and cannot be deleted
- **Sample invoices:** three fixed files in `public/samples/`; the drift sample is designed to show ₹32,000 recoverable
- **Currency display:** amounts shown in ₹; extracted currency is kept but not converted
- **Fuzzy match threshold:** 0.6 token overlap for matching invoice lines to rate card items
- **Vendor name matching:** ignores case, punctuation and common company suffixes (e.g. "Pvt Ltd")
- **Duplicate key:** vendor + invoice number + amount
- **Rate limit:** 12 checks per IP every 10 minutes on the public API, to protect API credits
- **Model:** `claude-sonnet-5-5` by default (overridable via `ANTHROPIC_MODEL`), effort set to low, max 8,000 output tokens, server-side fallbacks on
- **Port:** the app serves on `0.0.0.0:3000`

## Not covered yet
Scanned (image-only) PDFs, taxes and discounts, unit-of-measure conversion, multi-page invoice bundles, and multi-currency conversion.

## Run it locally
```bash
npm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY; Supabase is optional
npm run dev                  # http://localhost:3000
npm test
```
**On Replit:** add `ANTHROPIC_API_KEY` as a secret, build with `npm install && npm run build`, run with `npm start`. No Supabase secrets needed.

Open `/?sample=drift` (or `clean`, `duplicate`) to run a sample on load.

## Main code
- `lib/rateguard.ts`: matching, checks, dispute email
- `lib/rateguard-ai.ts`: Claude extraction
- `lib/contract-store.ts`: contracts library
- `app/api/check/route.ts`, `app/api/contracts/route.ts`: APIs
- `components/RateChecker.tsx`, `components/ContractsManager.tsx`: pages

## Tools used
Next.js 15, React, TypeScript, Tailwind CSS, Claude API by Anthropic (`@anthropic-ai/sdk`), Zod, PDF.js, Supabase (optional), Vitest, Claude Code, Replit.
Contract rate-drift checking, saved contracts, verdict flow and Claude integration built on 22 Nov 2026.
