import React from 'react';

export interface WeightDataPoint {
  date: string;
  weight: number;
}

export interface WeightChartProps {
  data: WeightDataPoint[];
  projectedWeeklyLoss?: number;
  className?: string;
}

export function WeightChart({ data, projectedWeeklyLoss = 0, className = '' }: WeightChartProps) {
  if (data.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 ${className}`}>
        <h3 className="text-white font-semibold text-lg mb-4">Peso</h3>
        <p className="text-indigo-300 text-center py-8">
          Registra tu peso para ver tu progreso
        </p>
      </div>
    );
  }

  const weights = data.map((d) => d.weight);
  const minWeight = Math.min(...weights) - 1;
  const maxWeight = Math.max(...weights) + 1;
  const range = maxWeight - minWeight || 1;

  const chartWidth = 400;
  const chartHeight = 150;
  const padding = { top: 10, right: 10, bottom: 25, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * innerWidth;
  const yScale = (w: number) => padding.top + innerHeight - ((w - minWeight) / range) * innerHeight;

  // Build SVG path for actual data
  const pathPoints = data.map((d, i) => `${xScale(i)},${yScale(d.weight)}`);
  const linePath = `M ${pathPoints.join(' L ')}`;

  // Build projection line
  let projectionPath = '';
  if (projectedWeeklyLoss > 0 && data.length >= 2) {
    const lastWeight = weights[weights.length - 1];
    const projectedWeight = lastWeight - projectedWeeklyLoss * 4; // 4 weeks ahead
    const lastX = xScale(data.length - 1);
    const projX = chartWidth - padding.right;
    const projY = yScale(Math.max(projectedWeight, minWeight));
    projectionPath = `M ${lastX},${yScale(lastWeight)} L ${projX},${projY}`;
  }

  // Y-axis labels
  const yLabels = [minWeight, (minWeight + maxWeight) / 2, maxWeight];

  return (
    <div className={`bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 ${className}`}>
      <h3 className="text-white font-semibold text-lg mb-4">Peso</h3>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis labels */}
        {yLabels.map((label) => (
          <g key={label}>
            <text
              x={padding.left - 5}
              y={yScale(label) + 4}
              textAnchor="end"
              className="fill-indigo-300"
              fontSize="10"
            >
              {label.toFixed(1)}
            </text>
            <line
              x1={padding.left}
              y1={yScale(label)}
              x2={chartWidth - padding.right}
              y2={yScale(label)}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Data line */}
        <path
          d={linePath}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.weight)}
            r="3"
            fill="#818cf8"
          />
        ))}

        {/* Projection line */}
        {projectionPath && (
          <path
            d={projectionPath}
            fill="none"
            stroke="#34d399"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {/* X-axis date labels (first and last) */}
        {data.length > 0 && (
          <>
            <text
              x={xScale(0)}
              y={chartHeight - 5}
              textAnchor="start"
              className="fill-indigo-300"
              fontSize="9"
            >
              {data[0].date}
            </text>
            {data.length > 1 && (
              <text
                x={xScale(data.length - 1)}
                y={chartHeight - 5}
                textAnchor="end"
                className="fill-indigo-300"
                fontSize="9"
              >
                {data[data.length - 1].date}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-indigo-300 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-indigo-400 inline-block" /> Peso real
        </span>
        {projectedWeeklyLoss > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-400 inline-block border-dashed" /> Proyección
          </span>
        )}
      </div>
    </div>
  );
}
