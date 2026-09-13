'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CopyMessageButton({
  text,
  label,
}: {
  text: () => string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  async function copy() {
    if (copying) return;
    const value = text();
    if (!value) return;
    if (timeout.current) clearTimeout(timeout.current);
    setCopying(true);
    setCopied(false);
    setNotice('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setNotice('已复制');
      timeout.current = setTimeout(() => {
        setCopied(false);
        setNotice('');
      }, 2000);
    } catch {
      setNotice('复制失败，请选中文字后复制。');
    } finally {
      setCopying(false);
    }
  }

  return (
    <span className="message-copy-control">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={copied ? '已复制' : label}
        title={copied ? '已复制' : label}
        disabled={copying}
        onClick={copy}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
      <span className="message-copy-notice" role="status">
        {notice}
      </span>
    </span>
  );
}
