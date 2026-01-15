import * as React from 'react'

import { cn } from '@/app/lib/utils'

interface SidePanelProps {
  children: React.ReactNode
  className?: string
  collapsed?: boolean
  open?: boolean
}

function SidePanel({
  children,
  className,
  collapsed = false,
  open = true
}: SidePanelProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed top-8 bottom-0 right-0 z-50',
        'bg-background border-l border-border',
        'flex flex-col transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-3' : 'w-96',
        className
      )}
    >
      {children}
    </div>
  )
}

interface SidePanelHeaderProps extends React.ComponentProps<'div'> {
  collapsed?: boolean
}

function SidePanelHeader({
  className,
  collapsed,
  ...props
}: SidePanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 p-4',
        collapsed && 'hidden',
        className
      )}
      {...props}
    />
  )
}

function SidePanelTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function SidePanelDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

interface SidePanelContentProps extends React.ComponentProps<'div'> {
  collapsed?: boolean
}

function SidePanelContent({
  className,
  collapsed,
  ...props
}: SidePanelContentProps) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0 overflow-y-auto',
        collapsed && 'hidden',
        className
      )}
      {...props}
    />
  )
}

interface SidePanelFooterProps extends React.ComponentProps<'div'> {
  collapsed?: boolean
}

function SidePanelFooter({
  className,
  collapsed,
  ...props
}: SidePanelFooterProps) {
  return (
    <div
      className={cn('mt-auto p-4', collapsed && 'hidden', className)}
      {...props}
    />
  )
}

export {
  SidePanel,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle
}
