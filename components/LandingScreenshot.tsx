import type { Dictionary } from '@/lib/i18n/get-dictionary';

const COLUMNS: { status: 'waiting' | 'in_progress' | 'paused'; color: string; cards: { title: string; meta: string }[] }[] = [
  {
    status: 'waiting',
    color: 'var(--waiting)',
    cards: [
      { title: 'Turnier-Stream aufsetzen', meta: 'Gaming House' },
      { title: 'Scrim-Gegner finden', meta: 'Remote' },
    ],
  },
  {
    status: 'in_progress',
    color: 'var(--progress)',
    cards: [{ title: 'Sponsoring-Banner drucken', meta: 'Köln' }],
  },
  {
    status: 'paused',
    color: 'var(--paused)',
    cards: [{ title: 'Reisekosten abrechnen', meta: 'Büro' }],
  },
];

export function LandingScreenshot({ dict }: { dict: Dictionary }) {
  return (
    <div className="browser-frame">
      <div className="browser-frame-bar">
        <span className="browser-frame-dot" />
        <span className="browser-frame-dot" />
        <span className="browser-frame-dot" />
        <span className="browser-frame-url">tl-radar.vercel.app/dashboard</span>
      </div>
      <div className="browser-frame-body">
        <div className="mock-kanban">
          {COLUMNS.map((col) => (
            <div className="mock-col" key={col.status}>
              <div className="mock-col-head">
                <span className="signal" style={{ background: col.color }} />
                {dict.status[col.status]}
              </div>
              {col.cards.map((card) => (
                <div className="mock-card" key={card.title}>
                  <div className="mock-card-top">
                    <span className="pill mock-pill" style={{ ['--pill-color' as string]: col.color }}>
                      {dict.status[col.status]}
                    </span>
                  </div>
                  <div className="mock-card-title">{card.title}</div>
                  <div className="mock-card-meta">{card.meta}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
