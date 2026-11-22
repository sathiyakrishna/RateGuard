import type { ContractItem } from './rateguard';

export type SavedContract = {
  id: string;
  vendor: string;
  name: string; // file the contract was read from
  items: ContractItem[];
  createdAt: string;
  sample?: boolean;
};

// The sample contract (public/samples/contract.txt), already extracted, so it is always in the library
// without a model call. Rates and clauses mirror that file.
const window = { validFrom: '2026-04-01', validTo: '2027-03-31', currency: 'INR' };

export const SAMPLE_CONTRACT: SavedContract = {
  id: 'sample',
  vendor: 'Apex Facility Services Pvt Ltd',
  name: 'contract.txt (sample)',
  createdAt: '2026-04-01T00:00:00.000Z',
  sample: true,
  items: [
    { item: 'Housekeeping staff', unit: 'person per month', rate: 18500, clause: '4.1', ...window },
    { item: 'Security guard, night shift', unit: 'shift', rate: 950, clause: '4.2', ...window },
    { item: 'Diesel generator maintenance', unit: 'visit', rate: 4200, clause: '5.1', ...window },
    { item: 'Pest control treatment', unit: 'quarter', rate: 12000, clause: '5.3', ...window },
    { item: 'Fire extinguisher refill', unit: 'unit', rate: 650, clause: '6.2', ...window }
  ]
};

export const SAMPLE_INVOICES = [
  { key: 'clean', label: 'Clean invoice', note: 'Every line at the contract rate', name: 'invoice-clean.txt', url: '/samples/invoice-clean.txt' },
  { key: 'drift', label: 'Rate drift', note: '2 lines billed above contract', name: 'invoice-drift.txt', url: '/samples/invoice-drift.txt' },
  { key: 'duplicate', label: 'Duplicate', note: 'The clean invoice, resubmitted', name: 'invoice-duplicate.txt', url: '/samples/invoice-duplicate.txt' }
] as const;
