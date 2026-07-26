import { Card, CardContent } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export function ChatbotView() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Chatbot</h1>
        <p className="text-foreground-muted">AI-powered assistant for scan analysis and remediation</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Bot className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Chatbot interface loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}
