import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import type { WeightEntry } from '@nova/types';
import { colors } from '@/theme';

interface Props {
  data: WeightEntry[];
}

export function WeightChart({ data }: Props) {
  if (data.length < 2) return null;

  const screenWidth = Dimensions.get('window').width - 64;
  const chartWidth = screenWidth;
  const chartHeight = 180;
  const padX = 45;
  const padY = 20;
  const chartW = chartWidth - padX * 2;
  const chartH = chartHeight - padY * 2;

  const weights = data.map((d) => d.weight);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - ((d.weight - minW) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    weight: minW + range * pct,
    y: padY + chartH - pct * chartH,
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Peso</Text>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines + Y labels */}
        {yLabels.map((label, i) => (
          <React.Fragment key={i}>
            <Line
              x1={padX}
              y1={label.y}
              x2={padX + chartW}
              y2={label.y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            <SvgText
              x={padX - 8}
              y={label.y + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.5)"
              fontSize={10}
            >
              {label.weight.toFixed(1)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Line */}
        <Path
          d={linePath}
          fill="none"
          stroke="#818cf8"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#818cf8"
            stroke={colors.gradient.from}
            strokeWidth={2}
          />
        ))}

        {/* X labels */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
          const p = points[idx];
          if (!p) return null;
          return (
            <SvgText
              key={idx}
              x={p.x}
              y={chartHeight - 2}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              fontSize={10}
            >
              {p.date.slice(5)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
});
