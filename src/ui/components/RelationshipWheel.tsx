import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { RelationshipSystem } from '../../systems/relationship/RelationshipSystem';

const CHARACTER_ORDER = ['aurelia', 'nyx', 'seraphine', 'mira', 'echo', 'elian'] as const;

const CHARACTER_COLORS: Record<string, string> = {
  aurelia:   '#fbbf24',
  nyx:       '#7c3aed',
  seraphine: '#fef3c7',
  mira:      '#34d399',
  echo:      '#93c5fd',
  elian:     '#f59e0b',
};

const CHARACTER_NAMES: Record<string, string> = {
  aurelia: 'Aurelia', nyx: 'Nyx', seraphine: 'Seraphine',
  mira: 'Mira', echo: 'Echo', elian: 'Elian',
};

const R_OUTER = 90;
const R_INNER = 28;
const CX = 110;
const CY = 110;
const N = CHARACTER_ORDER.length;

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function RelationshipWheel() {
  const relSystem = registry.get<RelationshipSystem>('relationship');

  const segments = useMemo(() => {
    return CHARACTER_ORDER.map((id, i) => {
      const stats = relSystem.getStats(id);
      const affinity = stats?.affinity ?? 0;
      const trust = stats?.trust ?? 0;
      const tension = stats?.tension ?? 0;

      const startAngle = (360 / N) * i;
      const endAngle = startAngle + 360 / N;
      const mid = (startAngle + endAngle) / 2;

      const r = R_INNER + ((affinity + 50) / 100) * (R_OUTER - R_INNER);
      const outer = polarToCart(CX, CY, r, startAngle);
      const outerEnd = polarToCart(CX, CY, r, endAngle);
      const inner = polarToCart(CX, CY, R_INNER, startAngle);
      const innerEnd = polarToCart(CX, CY, R_INNER, endAngle);
      const large = endAngle - startAngle > 180 ? 1 : 0;

      const path = [
        `M ${inner.x} ${inner.y}`,
        `L ${outer.x} ${outer.y}`,
        `A ${r} ${r} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${inner.x} ${inner.y}`,
        'Z',
      ].join(' ');

      const label = polarToCart(CX, CY, R_OUTER + 18, mid);
      const color = CHARACTER_COLORS[id] ?? '#ffffff';

      return { id, path, label, color, trust, tension, affinity };
    });
  }, []);

  return (
    <div className="flex flex-col items-center">
      <svg width={220} height={220} className="overflow-visible">
        {/* Rings */}
        {[25, 50, 75].map((r) => (
          <circle key={r} cx={CX} cy={CY} r={R_INNER + (r / 100) * (R_OUTER - R_INNER)}
            fill="none" stroke="white" strokeOpacity={0.06} strokeWidth={1} />
        ))}
        {/* Segments */}
        {segments.map((seg) => (
          <motion.path
            key={seg.id}
            d={seg.path}
            fill={seg.color}
            fillOpacity={0.3}
            stroke={seg.color}
            strokeWidth={1.5}
            strokeOpacity={0.6}
            whileHover={{ fillOpacity: 0.55 }}
            transition={{ duration: 0.15 }}
          >
            <title>{CHARACTER_NAMES[seg.id]}: affinity {seg.affinity > 0 ? '+' : ''}{seg.affinity}, trust {seg.trust}</title>
          </motion.path>
        ))}
        {/* Labels */}
        {segments.map((seg) => (
          <text
            key={`label-${seg.id}`}
            x={seg.label.x}
            y={seg.label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={seg.color}
            fontSize={9}
            fontFamily="Raleway, sans-serif"
            opacity={0.85}
          >
            {CHARACTER_NAMES[seg.id]}
          </text>
        ))}
        {/* Center dot */}
        <circle cx={CX} cy={CY} r={4} fill="white" fillOpacity={0.4} />
      </svg>

      {/* Stats legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
        {segments.map((seg) => (
          <div key={seg.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-white/50 text-xs">{CHARACTER_NAMES[seg.id]}</span>
            <span className="text-white/30 text-xs ml-auto">
              {seg.affinity > 0 ? '+' : ''}{seg.affinity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
