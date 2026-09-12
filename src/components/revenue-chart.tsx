import type { DayPoint } from "@/lib/metrics";

/** SVG bar chart of daily revenue (server component, no JS). */
export function RevenueBars({ points, currency = "₹" }: { points: DayPoint[]; currency?: string }) {
  const W = 720, H = 170, PAD_L = 44, PAD_R = 8;
  const max = Math.max(...points.map((p) => p.revenue));
  const scaleMax = max > 0 ? max : 1;
  const bw = (W - PAD_L - PAD_R) / points.length;
  const fmt = (n: number) => `${currency}${Math.round(n).toLocaleString("en-IN")}`;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="h-52 w-full min-w-[560px]">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} x2={W - PAD_R} y1={H - f * (H - 12)} y2={H - f * (H - 12)} stroke="#EEF0F3" />
            {max > 0 && (
              <text x={PAD_L - 6} y={H - f * (H - 12) + 3} fontSize="9" textAnchor="end" fill="#9AA3B0" fontFamily="Inter, sans-serif">
                {fmt(scaleMax * f)}
              </text>
            )}
          </g>
        ))}
        <line x1={PAD_L} x2={W - PAD_R} y1={H} y2={H} stroke="#E2E5EA" />
        {points.map((p, i) => {
          const h = (p.revenue / scaleMax) * (H - 12);
          const x = PAD_L + i * bw + bw * 0.2;
          const isToday = i === points.length - 1;
          return (
            <g key={p.date}>
              <rect x={x} y={H - h} width={bw * 0.6} height={h} rx="2.5" fill={isToday ? "#F97316" : "#FDBA74"}>
                <title>{`${p.date}: ${fmt(p.revenue)} · ${p.orders} orders`}</title>
              </rect>
              {(i % 5 === 0 || isToday) && (
                <text x={x + bw * 0.3} y={H + 16} fontSize="9" textAnchor="middle" fill="#9AA3B0" fontFamily="Inter, sans-serif">{p.date.slice(5)}</text>
              )}
            </g>
          );
        })}
        {max === 0 && <text x={W / 2} y={H / 2} fontSize="12" textAnchor="middle" fill="#9AA3B0" fontFamily="Inter, sans-serif">No orders in the last 30 days</text>}
      </svg>
    </div>
  );
}
