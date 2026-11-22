'use client';

import { useEffect, useRef, useState } from 'react';
import { rupees0 } from '@/lib/format';
import './visuals.css';

/* Landing hero: an invoice slides in next to the contract rate card and is checked line by line.
   Matching lines get a green tick, two lines turn amber with a callout, and a counter ticks up to the recoverable
   total. Figures are the sample drift invoice, so they match what "Try with sample data" shows.
   CSS transitions do the movement; a timer only steps the scene. Under prefers-reduced-motion (and before
   hydration) the finished scene is shown and nothing runs. */

const CONTRACT = [
  { item: 'Housekeeping staff', rate: 18500, clause: '4.1' },
  { item: 'Security guard, night', rate: 950, clause: '4.2' },
  { item: 'Generator maintenance', rate: 4200, clause: '5.1' },
  { item: 'Pest control', rate: 12000, clause: '5.3' },
  { item: 'Fire extinguisher refill', rate: 650, clause: '6.2' }
];

// invoice lines: contract row they match, quantity, billed rate
const LINES = [
  { item: 'Housekeeping staff', c: 0, qty: 20, rate: 19800 },
  { item: 'Security guard, night', c: 1, qty: 30, rate: 1150 },
  { item: 'Generator maintenance', c: 2, qty: 2, rate: 4200 },
  { item: 'Fire extinguisher refill', c: 4, qty: 40, rate: 650 }
].map((l) => ({ ...l, agreed: CONTRACT[l.c].rate, clause: CONTRACT[l.c].clause, over: Math.max(0, (l.rate - CONTRACT[l.c].rate) * l.qty) }));

const TOTAL = LINES.reduce((s, l) => s + l.over, 0); // 32,000

// stage 0 hidden · 1 cards in · 2+2i scanning line i · 3+2i line i resolved · 10 total shown · 11 fading out
const DELAY = [450, 900, 650, 350, 650, 350, 650, 350, 650, 700, 3600, 600];
const FINAL = 10;

function useCountUp(target: number, animate: boolean) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!animate) { setV(target); from.current = target; return; }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 700);
      const cur = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      setV(cur);
      from.current = cur;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return v;
}

const Tick = () => (
  <svg className="rg-tick h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="#067647" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill="#DCFAE6" stroke="none" />
    <path d="M5.5 10.5l3 3 6-6.5" />
  </svg>
);

export default function HeroAnimation() {
  const [stage, setStage] = useState(FINAL);
  const [live, setLive] = useState(false);
  const [visible, setVisible] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setStage(0);
    setLive(true);
  }, []);

  // pause while off screen or in a background tab
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live || !visible) return;
    const id = setTimeout(() => setStage((s) => (s + 1) % DELAY.length), DELAY[stage]);
    return () => clearTimeout(id);
  }, [live, visible, stage]);

  const shown = stage >= 1 && stage <= FINAL;
  const state = (i: number) => (stage < 2 + 2 * i ? 'pending' : stage === 2 + 2 * i ? 'scanning' : 'done');
  const counted = LINES.reduce((s, l, i) => (state(i) === 'done' ? s + l.over : s), 0);
  const total = useCountUp(counted, live);
  const finished = stage >= FINAL && stage <= 10;
  const slide = 'transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none';

  return (
    <div ref={box} className="w-full">
      <p className="sr-only">
        Animation: an invoice is checked line by line against the contract rate card. Two lines are billed above the agreed rate, and {rupees0(TOTAL)} is recoverable before payment.
      </p>
      <div aria-hidden="true" className="rounded-[28px] bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] p-3 shadow-[0_24px_60px_rgba(29,78,216,0.35)] sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
          {/* contract rate card */}
          <div className={`${slide} overflow-hidden rounded-2xl bg-white shadow-[0_14px_30px_rgba(11,31,77,0.25)] ${shown ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
            <div className="bg-[#0B1F4D] px-4 py-2.5 text-[13px] font-semibold text-white">Contract rate card</div>
            <ul className="text-[13px]">
              {CONTRACT.map((c, ci) => {
                const active = LINES.findIndex((l) => l.c === ci);
                const on = active >= 0 && state(active) === 'scanning';
                return (
                  <li key={c.item} className={`flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2 transition-colors duration-300 motion-reduce:transition-none ${on ? 'bg-[#DBEAFE]' : ''} ${active < 0 ? 'text-ink-500' : ''}`}>
                    <span className="min-w-0"><span className="block leading-tight">{c.item}</span><span className="block font-mono text-[11px] text-ink-500">Clause {c.clause}</span></span>
                    <span className="shrink-0 font-mono font-semibold">{rupees0(c.rate)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* invoice */}
          <div className={`${slide} overflow-hidden rounded-2xl bg-white shadow-[0_14px_30px_rgba(11,31,77,0.25)] ${shown ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
            <div className="flex justify-between gap-3 bg-[#0B1F4D] px-4 py-2.5 text-[13px] font-semibold text-white"><span>Invoice INV-2026-1058</span><span className="font-mono">Apex Facility</span></div>
            <ul className="text-[13px]">
              {LINES.map((l, i) => {
                const st = state(i);
                const flagged = l.over > 0;
                const done = st === 'done';
                return (
                  <li key={l.item} className={`border-b border-line-soft transition-colors duration-300 motion-reduce:transition-none ${done && flagged ? 'bg-[#FFF4D6]' : ''} ${st === 'scanning' ? 'bg-[#DBEAFE]' : ''}`}>
                    <div className={`flex items-center gap-2 px-4 py-2 ${st === 'scanning' ? 'rg-scan' : ''}`}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {done && !flagged && <Tick />}
                        {done && flagged && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F79009] text-[12px] font-extrabold leading-none text-white">!</span>}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{l.item}</span>
                      <span className="shrink-0 font-mono text-[12px] text-ink-500">{l.qty} × {rupees0(l.rate)}</span>
                    </div>
                    {flagged && (
                      <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${done ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <p className="mx-4 mb-2 ml-11 rounded-md bg-[#FEF0C7] px-2.5 py-1.5 text-[12px] font-semibold leading-snug text-[#93370D]">
                            Billed {rupees0(l.rate)} vs agreed {rupees0(l.agreed)} · Clause {l.clause}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className={`mt-3 flex flex-wrap items-baseline justify-between gap-x-4 rounded-2xl px-5 py-3 transition-colors duration-500 motion-reduce:transition-none sm:mt-4 ${finished ? 'bg-white' : 'bg-white/90'}`}>
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-500">Recoverable before payment</span>
          <span className={`font-mono text-[26px] font-extrabold tabular-nums transition-colors duration-500 motion-reduce:transition-none sm:text-[32px] ${total > 0 ? 'text-high-fg' : 'text-ink-500'}`}>{rupees0(total)}</span>
        </div>
      </div>
    </div>
  );
}
