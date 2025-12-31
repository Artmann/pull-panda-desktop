import { Component, type ReactNode } from 'react'

import { Button } from '@/app/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>

          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error.message}
          </p>

          <Button
            variant="outline"
            onClick={this.handleReset}
          >
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
