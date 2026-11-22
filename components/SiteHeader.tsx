import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function SiteHeader() {
  return (
    <header className="px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 rounded-2xl bg-[#0B1F4D] px-5 py-3 shadow-[0_12px_28px_rgba(11,31,77,0.30)] sm:px-7">
        <Link href="/" aria-label="RateGuard home"><Logo /></Link>
        <nav aria-label="Page" className="ml-auto flex gap-5 text-[17px] font-bold sm:gap-7">
          <Link href="/" className="text-white hover:underline">Check an invoice</Link>
          <Link href="/contracts" className="text-white hover:underline">Contracts</Link>
        </nav>
      </div>
    </header>
  );
}
