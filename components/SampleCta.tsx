'use client';

// Hero buttons: "Try with sample data" scrolls to the checker and opens its sample picker.
export default function SampleCta() {
  const open = () => {
    window.dispatchEvent(new Event('rg-open-sample'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('check')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  const BTN = 'inline-flex min-h-14 items-center justify-center rounded-lg px-7 text-base font-semibold';
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={open} className={`${BTN} bg-[#1D4ED8] text-white hover:bg-[#1E3A8A]`}>Try with sample data</button>
      <a href="/contracts" className={`${BTN} border-2 border-[#1D4ED8] bg-white text-[#1D4ED8] hover:bg-[#EEF3FF]`}>Add a contract</a>
    </div>
  );
}
