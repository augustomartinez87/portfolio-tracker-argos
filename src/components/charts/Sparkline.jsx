import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function Sparkline({ data, color = '#10B981', className }) {
  const chartData = useMemo(() => {
    return data.map((value, index) => ({ value, index }));
  }, [data]);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            fill={color}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
