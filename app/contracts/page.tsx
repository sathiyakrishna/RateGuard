import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import ContractsManager from '@/components/ContractsManager';

export const metadata: Metadata = { title: 'Contracts' };

export default function ContractsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EEF3FF] to-white text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-6 pb-16 pt-10 sm:px-8">
        <h1 className="mb-2 text-[40px] font-extrabold leading-[1.05] tracking-[-1.5px] text-[#0B1F4D] sm:text-[52px]">Contracts</h1>
        <p className="mb-8 max-w-2xl text-[17px] leading-[1.6] text-ink-700">Each vendor contract is read once and saved with its rate card. When you drop an invoice, RateGuard finds the contract for that vendor and checks every line against it.</p>
        <ContractsManager />
      </main>
    </div>
  );
}
