// Three-step strip under the hero. Inline SVG icons, no motion.
const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const STEPS = [
  {
    title: 'Contract on file',
    text: 'Saved once, with every agreed rate and clause.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-8 w-8" {...ICON} aria-hidden="true">
        <path d="M8 3h11l6 6v20H8z" />
        <path d="M19 3v6h6" />
        <path d="M12 16h9M12 21h9" />
        <path d="M12 26l2 2 4-4" />
      </svg>
    )
  },
  {
    title: 'Drop invoice',
    text: 'PDF or text. The vendor’s contract is found for you.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-8 w-8" {...ICON} aria-hidden="true">
        <path d="M16 4v14" />
        <path d="M10 12l6 6 6-6" />
        <path d="M5 20v6a2 2 0 002 2h18a2 2 0 002-2v-6" />
      </svg>
    )
  },
  {
    title: 'Verdict before you pay',
    text: 'OK to pay, hold with the amount overbilled, or duplicate.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-8 w-8" {...ICON} aria-hidden="true">
        <path d="M16 3l11 4v8c0 7-4.5 11.5-11 14C9.5 26.5 5 22 5 15V7z" />
        <path d="M11 16l3.5 3.5L21 12.5" />
      </svg>
    )
  }
];

const Arrow = () => (
  <svg viewBox="0 0 32 16" className="h-4 w-8 shrink-0 text-[#1D4ED8]" {...ICON} aria-hidden="true"><path d="M2 8h26M21 2l7 6-7 6" /></svg>
);

export default function StepStrip() {
  return (
    <ol aria-label="Three steps" className="mx-auto flex max-w-[1240px] flex-col items-stretch gap-3 px-6 pb-14 sm:px-8 md:flex-row md:items-center">
      {STEPS.map((s, i) => (
        <li key={s.title} className="contents">
          <div className="flex flex-1 items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(11,31,77,0.08)]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#1D4ED8]">{s.icon}</span>
            <span>
              <span className="block text-lg font-extrabold text-[#0B1F4D]">{i + 1}. {s.title}</span>
              <span className="block text-[15px] leading-snug text-ink-700">{s.text}</span>
            </span>
          </div>
          {i < STEPS.length - 1 && <span aria-hidden="true" className="flex justify-center md:block"><span className="block rotate-90 md:rotate-0"><Arrow /></span></span>}
        </li>
      ))}
    </ol>
  );
}
