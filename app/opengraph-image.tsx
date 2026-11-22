import { ImageResponse } from 'next/og';

export const alt = 'RateGuard – Catch vendor overbilling before you pay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Rendered on request, not at build: prerendering it at build time fails on Windows (@vercel/og "Invalid URL").
export const dynamic = 'force-dynamic';

export default function OG() {
  const rows = [
    ['Rate drift', '#FDE2E1', '#B42318', 'Housekeeping staff · cl. 4.1', '₹26,000.00'],
    ['Rate drift', '#FEF0C7', '#93370D', 'Security guard, night · cl. 4.2', '₹6,000.00'],
    ['OK', '#DCFAE6', '#067647', 'Generator maintenance · cl. 5.1', '₹0.00']
  ];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0B1F4D', padding: 64, color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 600, justifyContent: 'space-between' }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#7DA2FF' }}>RateGuard</div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.08 }}>Catch vendor overbilling before you pay.</div>
          <div style={{ fontSize: 26, color: '#C9D2E3' }}>Invoice rates checked against the contract rate card, clause by clause.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginLeft: 48, justifyContent: 'center', flex: 1 }}>
          {rows.map(([b, bg, fg, refs, amt]) => (
            <div key={refs} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#22325A', borderRadius: 14, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignSelf: 'flex-start', background: bg, color: fg, fontSize: 20, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>{b}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24 }}><span>{refs}</span><span>{amt}</span></div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
