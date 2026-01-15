import { useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'

interface DeviceCodeCardProps {
  userCode: string
  verificationUri: string
  onOpenUrl: () => void
}

export function DeviceCodeCard({
  userCode,
  verificationUri,
  onOpenUrl
}: DeviceCodeCardProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    await navigator.clipboard.writeText(userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to GitHub</CardTitle>
        <CardDescription>
          Enter the code below at{' '}
          <span
            className="font-mono text-foreground text-xs cursor-pointer"
            onClick={onOpenUrl}
          >
            {verificationUri}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <code className="rounded-lg bg-muted px-6 py-4 text-3xl font-bold tracking-widest">
            {userCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={copyCode}
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for authorization...
        </div>
      </CardContent>
    </Card>
  )
}
