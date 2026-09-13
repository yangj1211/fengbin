'use client';
import { ArrowLeft } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

export default function BackButton({
  destination,
  onClick,
  iconOnly = false,
  className = '',
}: {
  destination: string;
  onClick: () => void;
  iconOnly?: boolean;
  className?: string;
}) {
  const label = `返回${destination}`;
  const button = (
    <button
      type="button"
      className={`app-back-control ${className}`}
      data-icon-only={iconOnly || undefined}
      aria-label={label}
      onClick={onClick}
    >
      <ArrowLeft size={18} aria-hidden="true" />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
  return iconOnly ? (
    <Tooltip>
      <TooltipTrigger delay={200} render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ) : (
    button
  );
}
