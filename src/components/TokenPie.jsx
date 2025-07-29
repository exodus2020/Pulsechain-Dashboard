import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector, Legend } from 'recharts';
import styled from 'styled-components';
import { fUnit } from '../lib/numbers';
import { shortenString } from '../lib/string';
import { rgbStringToHex } from '../lib/utils';

const ChartContainer = styled.div`
  width: calc(100% - 40px);
  height: 250px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.7));
  border-radius: 10px;
  padding: 20px 20px 50px 20px;
  color: white;
  font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border-bottom: 1px solid rgb(50, 50, 50);

  outline: none;
  * {
    outline: none !important;
  }
  svg,
  .recharts-wrapper,
  .recharts-surface,
  .recharts-pie {
    outline: none !important;
  }

  @media (max-width: 650px) {
    width: calc(100dvw - 40px);
    transform: translateX(-40px);
  }
`;

const CustomTooltip = styled.div`
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  color: white;
  font-size: 14px;

  .label {
    font-weight: bold;
    margin-bottom: 8px;
    color: #00ff88;
  }

  .value {
    margin: 4px 0;
  }
`;

function TokenPie({ balances, aliases = {} }) {
  if (!balances || balances.length === 0) return null;

  return <TokenPieChart balances={balances} aliases={aliases} />;
}

const TokenPieChart = memo(function TokenPieChart({ balances, aliases = {} }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const variables = useRef(null);

  // Memoize chart data to avoid recalculation
  const chartData = useMemo(() => {
    if (!balances || balances.length === 0) return [];

    // Filter out zero balances
    const nonZeroBalances = balances.filter(item => (item.balance || 0) > 0);
    if (nonZeroBalances.length === 0) return [];

    // Sort by balance
    const sortedData = nonZeroBalances.sort((a, b) => (b.balance || 0) - (a.balance || 0));

    // Calculate total for percentage
    const totalBalance = sortedData.reduce((sum, item) => sum + (item.balance || 0), 0);

    // Separate large and small segments
    const threshold = 0.02; // 2% threshold
    const largeSegments = [];
    const smallSegments = [];

    sortedData.forEach(item => {
      const percentage = (item.balance || 0) / totalBalance;
      const segment = {
        address: item.address,
        balance: item.balance || 0,
        balanceUsd: item.balanceUsd || 0,
        value: item.balance || 0,
      };
      if (percentage >= threshold) {
        largeSegments.push(segment);
      } else {
        smallSegments.push(segment);
      }
    });

    // Create "Others" category
    if (smallSegments.length > 0) {
      const otherCategory = {
        address: 'Others',
        balance: smallSegments.reduce((sum, item) => sum + item.balance, 0),
        balanceUsd: smallSegments.reduce((sum, item) => sum + item.balanceUsd, 0),
        value: smallSegments.reduce((sum, item) => sum + item.value, 0),
      };
      return [...largeSegments, otherCategory];
    }

    return largeSegments;
  }, [balances]);

  // Memoize colors to avoid recalculation
  const colors = useMemo(() => {
    if (chartData.length <= 1) return ['#00ff88'];

    const gradientStops = [
      { pos: 0, color: rgbStringToHex('rgb(139, 209, 111)') },
      { pos: 100, color: rgbStringToHex('rgb(81, 181, 221)') },
    ];

    const colors = [];
    for (let i = 0; i < chartData.length; i++) {
      const position = (i / (chartData.length - 1)) * 100;
      let startStop = gradientStops[0];
      let endStop = gradientStops[gradientStops.length - 1];

      for (let j = 0; j < gradientStops.length - 1; j++) {
        if (position >= gradientStops[j].pos && position <= gradientStops[j + 1].pos) {
          startStop = gradientStops[j];
          endStop = gradientStops[j + 1];
          break;
        }
      }

      const ratio = (position - startStop.pos) / (endStop.pos - startStop.pos);
      const r1 = parseInt(startStop.color.slice(1, 3), 16);
      const g1 = parseInt(startStop.color.slice(3, 5), 16);
      const b1 = parseInt(startStop.color.slice(5, 7), 16);
      const r2 = parseInt(endStop.color.slice(1, 3), 16);
      const g2 = parseInt(endStop.color.slice(3, 5), 16);
      const b2 = parseInt(endStop.color.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * ratio);
      const g = Math.round(g1 + (g2 - g1) * ratio);
      const b = Math.round(b1 + (b2 - b1) * ratio);
      colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    }

    return colors;
  }, [chartData.length]);

  const getColor = (index) => colors[index] || colors[0];

  const CustomTooltipContent = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <CustomTooltip>
          <div className="label">Address: {aliases[data.address.toLowerCase()] ?? shortenString(data.address)}</div>
          <div className="value">Balance: {fUnit(parseFloat(data.balance), 2)}</div>
          <div className="value">USD Value: ${fUnit(parseFloat(data.balanceUsd), 2)}</div>
        </CustomTooltip>
      );
    }
    return null;
  };

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
      </g>
    );
  };

  if (!chartData.length) {
    return (
      <ChartContainer>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>No balance data available</div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Wallet Distribution</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            minAngle={3}
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index)} />
            ))}
          </Pie>
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ color: 'white', fontSize: '12px' }}
            formatter={(value, entry) =>
              entry?.payload?.address
                ? `${shortenString(aliases[entry.payload.address.toLowerCase()] ?? entry.payload.address)} - $${fUnit(parseFloat(entry.payload.balanceUsd), 0)}`
                : 'Unknown'
            }
          />
          <Tooltip content={<CustomTooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

export default memo(TokenPie);