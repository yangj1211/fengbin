'use client';
import {
  UsersRound,
  Wrench,
  Zap,
  ChartNoAxesCombined,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleId } from './model';
export const agentIcons: Record<ModuleId, LucideIcon> = {
  customer: UsersRound,
  maintenance: Wrench,
  energy: Zap,
  production: ChartNoAxesCombined,
  supplier: ShieldCheck,
};
export function AgentIdentity({
  id,
  large = false,
}: {
  id: ModuleId;
  large?: boolean;
}) {
  const Icon = agentIcons[id];
  return (
    <span
      className={`agent-identity identity-${id}${large ? ' identity-large' : ''}`}
    >
      <Icon size={large ? 30 : 23} strokeWidth={1.7} />
    </span>
  );
}
