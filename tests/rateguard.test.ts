import { describe, expect, it } from 'vitest';
import { checkInvoice, checkLine, draftDisputeEmail, duplicateKey, similarity, type ContractItem, type Invoice } from '@/lib/rateguard';

const card: ContractItem[] = [
  { item: 'Housekeeping staff', unit: 'person/month', rate: 18500, currency: 'INR', validFrom: '2026-04-01', validTo: '2027-03-31', clause: '4.1' },
  { item: 'Security guard, night shift', unit: 'shift', rate: 950, currency: 'INR', validFrom: '2026-04-01', validTo: '2027-03-31', clause: '4.2' },
  { item: 'Pest control treatment', unit: 'quarter', rate: 12000, currency: 'INR', validFrom: '2025-04-01', validTo: '2026-09-30', clause: '5.3' },
  { item: 'Pest control treatment', unit: 'quarter', rate: 13000, currency: 'INR', validFrom: '2026-10-01', validTo: '2027-03-31', clause: '5.3A' }
];
const line = (item: string, quantity: number, rate: number) => ({ item, quantity, rate, amount: quantity * rate });

describe('similarity', () => {
  it('matches reworded items and rejects different ones', () => {
    expect(similarity('Night security guard', 'Security guard, night shift')).toBeGreaterThanOrEqual(0.6);
    expect(similarity('Housekeeping staffs', 'Housekeeping staff')).toBeGreaterThanOrEqual(0.9);
    expect(similarity('Generator fuel', 'Generator maintenance')).toBeLessThan(0.6);
  });
});

describe('checkLine', () => {
  it('flags rate drift with the overbilled amount and clause', () => {
    const r = checkLine(line('Housekeeping staff (per month)', 20, 19800), card, '2026-11-20');
    expect(r).toMatchObject({ status: 'rate_drift', agreedRate: 18500, clause: '4.1', overbilled: 26000 });
  });
  it('passes a rate at or below the agreed rate', () => {
    expect(checkLine(line('Security guard night shift', 30, 950), card, '2026-11-20').status).toBe('ok');
    expect(checkLine(line('Security guard night shift', 30, 900), card, '2026-11-20').overbilled).toBe(0);
  });
  it('flags items that are not in the contract at their full amount', () => {
    const r = checkLine(line('Rooftop solar panel cleaning', 2, 5000), card, '2026-11-20');
    expect(r).toMatchObject({ status: 'not_in_contract', overbilled: 10000, clause: null });
  });
  it('picks the rate valid on the invoice date, and flags an expired one', () => {
    expect(checkLine(line('Pest control', 1, 13000), card, '2026-11-05')).toMatchObject({ status: 'ok', clause: '5.3A' });
    expect(checkLine(line('Pest control', 1, 12000), card, '2026-07-05')).toMatchObject({ status: 'ok', clause: '5.3' });
    const late = checkLine(line('Pest control', 1, 14000), card, '2027-06-01');
    expect(late).toMatchObject({ status: 'expired_rate', agreedRate: 13000, overbilled: 1000 });
  });
});

describe('checkInvoice and duplicates', () => {
  const inv: Invoice = { vendor: 'Apex Facility Services Pvt Ltd', invoiceNumber: 'INV-2026-1041', date: '2026-11-05', total: 443000, lines: [line('Housekeeping staff', 20, 18500)] };
  it('totals recoverable by status and drafts an email citing the clause', () => {
    const r = checkInvoice({ ...inv, lines: [line('Housekeeping staff', 20, 19800), line('Security guard night shift', 30, 1150), line('Window tinting', 1, 800)] }, card);
    expect(r.breakdown).toEqual({ rate_drift: 32000, not_in_contract: 800, expired_rate: 0 });
    expect(r.recoverable).toBe(32800);
    const mail = draftDisputeEmail(r);
    expect(mail).toContain('clause 4.1');
    expect(mail).toContain('clause 4.2');
    expect(mail).toContain('Window tinting');
  });
  it('treats punctuation and company suffix differences as the same invoice', () => {
    expect(duplicateKey({ ...inv, vendor: 'Apex Facility Services Pvt. Ltd.', invoiceNumber: 'INV 2026/1041' })).toBe(duplicateKey(inv));
    expect(duplicateKey({ ...inv, total: 443001 })).not.toBe(duplicateKey(inv));
  });
});

import { matchContract } from '@/lib/rateguard';
import { SAMPLE_CONTRACT } from '@/lib/sample-contract';

describe('saved contracts and the sample contract', () => {
  const contracts = [SAMPLE_CONTRACT, { ...SAMPLE_CONTRACT, id: 'b', vendor: 'Apex Facility Solutions Ltd' }];
  it('matches the invoice vendor to a saved contract, ignoring suffixes and punctuation', () => {
    expect(matchContract('Apex Facility Services Pvt. Ltd.', contracts)?.id).toBe('sample');
    expect(matchContract('APEX FACILITY SERVICES PRIVATE LIMITED', contracts)?.id).toBe('sample');
    expect(matchContract('Globex Logistics', contracts)).toBeNull();
    expect(matchContract('', contracts)).toBeNull();
  });
  it('checks the sample drift invoice to ₹32,000 across 2 lines, and the clean one to ₹0', () => {
    const drift: Invoice = { vendor: 'Apex Facility Services Pvt Ltd', invoiceNumber: 'INV-2026-1058', date: '2026-11-20', total: 464900, lines: [
      line('Housekeeping staff (per month)', 20, 19800), line('Security guard - night shift', 30, 1150), line('Diesel generator maintenance visit', 2, 4200), line('Fire extinguisher refill (unit)', 40, 650)] };
    const r = checkInvoice(drift, SAMPLE_CONTRACT.items);
    expect(r.counts.rate_drift).toBe(2);
    expect(r.recoverable).toBe(32000);
    const clean: Invoice = { ...drift, invoiceNumber: 'INV-2026-1041', date: '2026-11-05', lines: [
      line('Housekeeping staff (per month)', 20, 18500), line('Security guard - night shift', 28, 950), line('Diesel generator maintenance visit', 2, 4200), line('Pest control treatment (quarterly)', 1, 12000), line('Fire extinguisher refill (unit)', 40, 650)] };
    expect(checkInvoice(clean, SAMPLE_CONTRACT.items).recoverable).toBe(0);
  });
});
