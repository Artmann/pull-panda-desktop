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

export function ChartContainer({
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
  barColor = 'hsl(var(--chart-1))',
  showGrid = true,
  formatXAxis,
  formatTooltip
}: BarChartProps<T>): React.ReactElement {
  return (
    <ChartContainer className={className}>
      <RechartsBarChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}
        <XAxis
          dataKey={xKey}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatXAxis}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
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

// Line Chart
interface LineChartProps<T extends object> {
  data: T[]
  xKey: keyof T & string
  yKey: keyof T & string
  className?: string
  lineColor?: string
  showGrid?: boolean
  referenceLine?: number
  referenceLineColor?: string
  formatXAxis?: (value: unknown) => string
  formatTooltip?: (value: unknown) => string
}

export function LineChart<T extends object>({
  data,
  xKey,
  yKey,
  className,
  lineColor = 'hsl(var(--chart-2))',
  showGrid = true,
  referenceLine,
  referenceLineColor = 'hsl(var(--destructive))',
  formatXAxis,
  formatTooltip
}: LineChartProps<T>): React.ReactElement {
  return (
    <ChartContainer className={className}>
      <RechartsLineChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}
        <XAxis
          dataKey={xKey}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatXAxis}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
          formatter={(value) => [
            formatTooltip ? formatTooltip(value) : value,
            ''
          ]}
        />
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
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
        />
      </RechartsLineChart>
    </ChartContainer>
  )
}

// Combined Chart with Bar and Line
interface ComboChartProps<T extends object> {
  data: T[]
  xKey: keyof T & string
  barKey: keyof T & string
  lineKey: keyof T & string
  className?: string
  barColor?: string
  lineColor?: string
  showGrid?: boolean
  referenceLine?: number
  referenceLineColor?: string
  formatXAxis?: (value: unknown) => string
}

export function ComboChart<T extends object>({
  data,
  xKey,
  barKey,
  lineKey,
  className,
  barColor = 'hsl(var(--chart-1))',
  lineColor = 'hsl(var(--chart-2))',
  showGrid = true,
  referenceLine,
  referenceLineColor = 'hsl(var(--destructive))',
  formatXAxis
}: ComboChartProps<T>): React.ReactElement {
  return (
    <ChartContainer className={className}>
      <RechartsBarChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}
        <XAxis
          dataKey={xKey}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatXAxis}
        />
        <YAxis
          yAxisId="left"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        />
        {referenceLine !== undefined && (
          <ReferenceLine
            y={referenceLine}
            yAxisId="right"
            stroke={referenceLineColor}
            strokeDasharray="5 5"
          />
        )}
        <Bar
          yAxisId="left"
          dataKey={barKey}
          fill={barColor}
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={lineKey}
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
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
  referenceLineColor = 'hsl(var(--destructive))',
  formatXAxis
}: MultiLineChartProps<T>): React.ReactElement {
  return (
    <ChartContainer className={className}>
      <RechartsLineChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}
        <XAxis
          dataKey={xKey}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatXAxis}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        />
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
