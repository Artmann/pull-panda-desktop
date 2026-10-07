import * as React from 'react'
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { cn } from '@/app/lib/utils'

// Chart container
interface ChartContainerProps {
  children: React.ReactNode
  className?: string
}

function ChartContainer({
  children,
  className
}: ChartContainerProps): React.ReactElement {
  return (
    <div className={cn('h-[300px] w-full', className)}>
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

// Shared axis, grid and tooltip styling
const axisProps = {
  axisLine: false,
  fontSize: 12,
  stroke: 'var(--muted-foreground)',
  tickLine: false
}

const gridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  vertical: false
}

const tooltipContentStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  fontSize: '12px',
  padding: '8px 12px'
}

function formatYAxis(value: unknown): string {
  return `${value}`
}

// Bar Chart
interface BarChartProps<T extends object> {
  data: T[]
  xKey: keyof T & string
  yKey: keyof T & string
  className?: string
  barColor?: string
  showGrid?: boolean
  formatXAxis?: (value: unknown) => string
  formatTooltip?: (value: unknown) => string
}

export function BarChart<T extends object>({
  data,
  xKey,
  yKey,
  className,
  barColor = 'var(--chart-1)',
  showGrid = true,
  formatXAxis,
  formatTooltip
}: BarChartProps<T>): React.ReactElement {
  return (
    <ChartContainer className={className}>
      <RechartsBarChart data={data}>
        {showGrid && <CartesianGrid {...gridProps} />}
        <XAxis
          {...axisProps}
          dataKey={xKey}
          tickFormatter={formatXAxis}
        />
        <YAxis
          {...axisProps}
          tickFormatter={formatYAxis}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value) => [
            formatTooltip ? formatTooltip(value) : value,
            ''
          ]}
        />
        <Bar
          dataKey={yKey}
          fill={barColor}
          radius={[4, 4, 0, 0]}
        />
      </RechartsBarChart>
    </ChartContainer>
  )
}

// Multi-Line Chart
interface LineConfig {
  key: string
  label: string
  color: string
}

interface MultiLineChartProps<T extends object> {
  data: T[]
  xKey: keyof T & string
  lines: LineConfig[]
  className?: string
  showGrid?: boolean
  referenceLine?: number
  referenceLineColor?: string
  formatXAxis?: (value: unknown) => string
}

export function MultiLineChart<T extends object>({
  data,
  xKey,
  lines,
  className,
  showGrid = true,
  referenceLine,
  referenceLineColor = 'var(--destructive)',
  formatXAxis
}: MultiLineChartProps<T>): React.ReactElement {
  return (
    <ChartContainer className={className}>
      <RechartsLineChart data={data}>
        {showGrid && <CartesianGrid {...gridProps} />}
        <XAxis
          {...axisProps}
          dataKey={xKey}
          tickFormatter={formatXAxis}
        />
        <YAxis
          {...axisProps}
          tickFormatter={formatYAxis}
        />
        <Tooltip contentStyle={tooltipContentStyle} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {referenceLine !== undefined && (
          <ReferenceLine
            y={referenceLine}
            stroke={referenceLineColor}
            strokeDasharray="5 5"
            label={{
              value: 'Low quota',
              fill: referenceLineColor,
              fontSize: 10
            }}
          />
        )}
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  )
}
