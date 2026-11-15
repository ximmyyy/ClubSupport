import { SECTION_LABELS } from "@/lib/meta";

export interface PitchOccupant {
  key: string;
  sections: number[];
  title: string;
  subtitle?: string;
  color: string;
  match?: boolean;
}

const W = 210;
const H = 136;

function rectFor(sections: number[]) {
  const left = sections.some((s) => s === 0 || s === 1);
  const right = sections.some((s) => s === 2 || s === 3);
  const top = sections.some((s) => s === 0 || s === 2);
  const bottom = sections.some((s) => s === 1 || s === 3);
  const x = left ? 0 : W / 2;
  const w = left && right ? W : W / 2;
  const y = top ? 0 : H / 2;
  const h = top && bottom ? H : H / 2;
  return { x, y, w, h };
}

/** Top-down football pitch. Sections: A top-left, B bottom-left, C top-right, D bottom-right. */
export function Pitch({ occupants = [], closed, showSections = true, className }: {
  occupants?: PitchOccupant[]; closed?: string; showSections?: boolean; className?: string;
}) {
  const line = "rgba(255,255,255,0.85)";
  return (
    <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} className={className} role="img" aria-label="Veldindeling">
      <defs>
        <pattern id="stripes" width="30" height={H} patternUnits="userSpaceOnUse">
          <rect width="15" height={H} fill="#2f8f4e" />
          <rect x="15" width="15" height={H} fill="#2a854a" />
        </pattern>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="rgba(255,255,255,0.22)" />
        </pattern>
      </defs>
      <rect x={-6} y={-6} width={W + 12} height={H + 12} rx={8} fill="#277a42" />
      <rect width={W} height={H} fill="url(#stripes)" />
      {/* markings */}
      <g fill="none" stroke={line} strokeWidth={0.9}>
        <rect width={W} height={H} />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
        <circle cx={W / 2} cy={H / 2} r={18} />
        <rect x={0} y={H / 2 - 40} width={33} height={80} />
        <rect x={0} y={H / 2 - 18} width={11} height={36} />
        <rect x={W - 33} y={H / 2 - 40} width={33} height={80} />
        <rect x={W - 11} y={H / 2 - 18} width={11} height={36} />
        <path d={`M33 ${H / 2 - 14} A 18 18 0 0 1 33 ${H / 2 + 14}`} />
        <path d={`M${W - 33} ${H / 2 - 14} A 18 18 0 0 0 ${W - 33} ${H / 2 + 14}`} />
        <rect x={-3} y={H / 2 - 7} width={3} height={14} />
        <rect x={W} y={H / 2 - 7} width={3} height={14} />
      </g>
      <circle cx={W / 2} cy={H / 2} r={1.2} fill={line} />
      {showSections && (
        <g stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" strokeWidth={0.8}>
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} />
        </g>
      )}
      {showSections &&
        SECTION_LABELS.map((l, i) => {
          const r = rectFor([i]);
          return (
            <text key={l} x={r.x + (i < 2 ? 6 : r.w - 6)} y={r.y + 11} fontSize={8} fontWeight={700} fill="rgba(255,255,255,0.55)" textAnchor={i < 2 ? "start" : "end"}>
              {l}
            </text>
          );
        })}
      {occupants.map((o) => {
        const r = rectFor(o.sections);
        const pad = 2.5;
        const wide = r.w > W / 2;
        const titleSize = wide ? 15 : 11;
        const subSize = wide ? 9 : 7;
        const maxChars = wide ? 34 : 22;
        return (
          <g key={o.key}>
            <rect x={r.x + pad} y={r.y + pad} width={r.w - pad * 2} height={r.h - pad * 2} rx={5} fill={o.color} fillOpacity={0.88} stroke="#fff" strokeWidth={1.2} />
            {o.match && <rect x={r.x + pad} y={r.y + pad} width={r.w - pad * 2} height={r.h - pad * 2} rx={5} fill="url(#hatch)" />}
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (o.subtitle ? 2 : -3)} textAnchor="middle" fontSize={titleSize} fontWeight={700} fill="#fff">
              {o.title}
            </text>
            {o.subtitle && (
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (wide ? 13 : 10)} textAnchor="middle" fontSize={subSize} fill="rgba(255,255,255,0.92)">
                {o.subtitle.length > maxChars ? `${o.subtitle.slice(0, maxChars - 1)}…` : o.subtitle}
              </text>
            )}
          </g>
        );
      })}
      {closed && (
        <g>
          <rect width={W} height={H} fill="rgba(28,25,23,0.62)" />
          <text x={W / 2} y={H / 2 - 2} textAnchor="middle" fontSize={16} fontWeight={800} fill="#fff">AFGEKEURD</text>
          <text x={W / 2} y={H / 2 + 14} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)">{closed}</text>
        </g>
      )}
    </svg>
  );
}
