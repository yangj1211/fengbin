'use client';

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardChatEntry({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="dashboard-chat-entry"
      onClick={onClick}
    >
      <MessageSquare aria-hidden="true" />
      智能问答
    </Button>
  );
}
