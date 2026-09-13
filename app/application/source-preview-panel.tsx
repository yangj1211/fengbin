'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

type PreviewDock = {
  host: HTMLDivElement | null;
  activeId: string | null;
  show: (id: string, close: () => void) => void;
  release: (id: string) => void;
};
const PreviewContext = createContext<PreviewDock | null>(null);

/** One source surface per conversation, outside the text copied as an answer. */
export function SourcePreviewScope({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useRef<{ id: string; close: () => void } | null>(null);
  const show = useCallback((id: string, close: () => void) => {
    const previous = active.current;
    active.current = { id, close };
    if (previous && previous.id !== id) previous.close();
    setActiveId(id);
  }, []);
  const release = useCallback((id: string) => {
    if (active.current?.id !== id) return;
    active.current = null;
    setActiveId(null);
  }, []);
  const value = useMemo(
    () => ({ host, activeId, show, release }),
    [host, activeId, show, release],
  );
  return (
    <PreviewContext.Provider value={value}>
      <div className={`conversation-split${activeId ? ' is-source-open' : ''}`}>
        <div className="conversation-chat-column">{children}</div>
        <div
          ref={setHost}
          className="conversation-source-slot"
          hidden={!activeId}
        />
      </div>
    </PreviewContext.Provider>
  );
}

export default function SourcePreviewPanel({
  open,
  title,
  description,
  hideDescription = false,
  className,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  hideDescription?: boolean;
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dock = useContext(PreviewContext);
  const id = useId();
  const titleId = useId();
  const panel = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  const show = dock?.show;
  const release = dock?.release;
  useEffect(() => {
    if (!open || !show || !release) return;
    show(id, () => close.current());
    return () => release(id);
  }, [id, open, show, release]);
  const visible = Boolean(open && dock?.host && dock.activeId === id);
  useEffect(() => {
    if (!visible) return;
    const opener = document.activeElement;
    const element = panel.current;
    element?.focus({ preventScroll: true });
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        event.target instanceof Node &&
        element?.contains(event.target)
      )
        close.current();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      if (
        element?.contains(document.activeElement) &&
        opener instanceof HTMLElement &&
        opener.isConnected
      )
        opener.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!dock) {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent className={className}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription
              className={hideDescription ? 'sr-only' : undefined}
            >
              {description}
            </SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  if (!visible || !dock.host) return null;
  return createPortal(
    <section
      ref={panel}
      className={`source-preview-panel ${className}`}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header data-slot="sheet-header">
        <h2 id={titleId} data-slot="sheet-title">
          {title}
        </h2>
        <p
          data-slot="sheet-description"
          className={hideDescription ? 'sr-only' : undefined}
        >
          {description}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="source-preview-close"
          aria-label="关闭来源预览"
          title="关闭来源预览"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </header>
      {children}
    </section>,
    dock.host,
  );
}
