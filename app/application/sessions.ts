import {
  defaultInputs,
  type Inputs,
  type ModuleId,
  type WorkspaceState,
} from './model';
import type { ConversationSession, ConversationTurn } from './conversation';
import { normalizeCustomerInputs } from './customer-engine';
import { normalizeMaintenanceInputs } from './maintenance-engine';
import { withFixedRules } from './fixed-rules';

export const CONVERSATION_TITLE_MAX_LENGTH = 48;

export function conversationTitleError(value: string): string {
  const title = value.trim();
  if (!title) return '请输入对话名称。';
  if (title.length > CONVERSATION_TITLE_MAX_LENGTH)
    return '对话名称最多 ' + CONVERSATION_TITLE_MAX_LENGTH + ' 个字符。';
  return '';
}

export function conversationTitle(
  session: ConversationSession,
  automaticTitle: string,
): string {
  return session.titleEdited ? session.title : automaticTitle;
}

export function renameConversation(
  state: WorkspaceState,
  sessionId: string,
  value: string,
): WorkspaceState {
  const error = conversationTitleError(value);
  if (error) throw new Error(error);
  if (!state.sessions?.some((session) => session.id === sessionId))
    throw new Error('这段对话已不存在，请选择其他对话。');
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, title: value.trim(), titleEdited: true }
        : session,
    ),
  };
}

function searchableText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  if (value && typeof value === 'object')
    return Object.values(value).map(searchableText).join(' ');
  return '';
}
export function searchConversations(
  sessions: ConversationSession[],
  query: string,
): ConversationSession[] {
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return sessions;
  return sessions.filter((session) => {
    const text = normalize(
      searchableText([
        session.title,
        session.draft.question,
        session.turns.map((turn) => [
          turn.question,
          turn.answer,
          turn.sourceName,
          turn.inputs,
          turn.analysis,
        ]),
      ]),
    );
    return terms.every((term) => text.includes(term));
  });
}
export function currentSession(
  state: WorkspaceState,
  module: ModuleId,
): ConversationSession | undefined {
  const sessions = (state.sessions ?? []).filter((s) => s.module === module);
  return (
    sessions.find((s) => s.id === state.activeSessionIds?.[module]) ??
    sessions[0]
  );
}
export function energyConditions(input: Inputs): Inputs {
  return {
    process: input.process ?? defaultInputs.energy.process,
    line: input.line || '全部产线',
    period: input.period ?? defaultInputs.energy.period,
    change: input.change ?? defaultInputs.energy.change,
    dateFrom: input.dateFrom ?? '',
    dateTo: input.dateTo ?? '',
    granularity: input.granularity || 'day',
    plannedProduction: input.plannedProduction ?? '',
  };
}
export function applyEnergyDashboardConditions(
  state: WorkspaceState,
  input: Inputs,
): WorkspaceState {
  return applyDashboardConditions(state, 'energy', input);
}
export function applyDashboardConditions(
  state: WorkspaceState,
  module: 'energy' | 'production' | 'supplier',
  input: Inputs,
): WorkspaceState {
  const current = currentSession(state, module);
  const conditions =
    module === 'energy'
      ? energyConditions(input)
      : module === 'production'
        ? { line: input.line ?? defaultInputs.production.line }
        : { supplier: input.supplier ?? defaultInputs.supplier.supplier };
  if (!current) return startConversation(state, module, conditions);
  return {
    ...state,
    moduleViews: { ...state.moduleViews, [module]: 'chat' },
    sessions: (state.sessions ?? []).map((session) =>
      session.id === current.id
        ? {
            ...session,
            draft: withFixedRules(module, { ...session.draft, ...conditions }),
          }
        : session,
    ),
  };
}
export function startConversation(
  state: WorkspaceState,
  module: ModuleId,
  draft?: Inputs,
): WorkspaceState {
  const current = currentSession(state, module);
  if (
    !draft &&
    current &&
    !current.titleEdited &&
    !current.turns.length &&
    Object.entries(current.draft).every(
      ([k, v]) => v === (defaultInputs[module][k] ?? ''),
    )
  )
    return state.moduleViews?.[module] === 'chat'
      ? state
      : {
          ...state,
          moduleViews: { ...state.moduleViews, [module]: 'chat' },
        };
  const now = new Date().toISOString();
  const session: ConversationSession = {
    id: crypto.randomUUID(),
    module,
    title: draft?.question?.trim().slice(0, 48) || '新对话',
    createdAt: now,
    updatedAt: now,
    turns: [],
    draft:
      module === 'customer' && draft
        ? normalizeCustomerInputs(draft)
        : module === 'maintenance'
          ? normalizeMaintenanceInputs(draft ?? {})
          : withFixedRules(module, {
              ...defaultInputs[module],
              ...draft,
              question: draft?.question ?? '',
            }),
  };
  return {
    ...state,
    sessions: [session, ...(state.sessions ?? [])],
    activeSessionIds: { ...state.activeSessionIds, [module]: session.id },
    moduleViews: { ...state.moduleViews, [module]: 'chat' },
  };
}
export function selectConversation(
  state: WorkspaceState,
  sessionId: string,
): WorkspaceState {
  const session = state.sessions?.find((s) => s.id === sessionId);
  return session
    ? {
        ...state,
        moduleViews: { ...state.moduleViews, [session.module]: 'chat' },
        activeSessionIds: {
          ...state.activeSessionIds,
          [session.module]: session.id,
        },
      }
    : state;
}
export function removeConversation(
  state: WorkspaceState,
  sessionId: string,
): WorkspaceState {
  const removed = state.sessions?.find((s) => s.id === sessionId);
  if (!removed) return state;
  const sessions = (state.sessions ?? []).filter((s) => s.id !== sessionId);
  const activeSessionIds = { ...state.activeSessionIds };
  if (activeSessionIds[removed.module] === sessionId) {
    const next = sessions.find((s) => s.module === removed.module);
    if (next) activeSessionIds[removed.module] = next.id;
    else delete activeSessionIds[removed.module];
  }
  return { ...state, sessions, activeSessionIds };
}

export function mergeConversationTurns(
  existing: ConversationTurn[],
  incoming: ConversationTurn[],
): ConversationTurn[] {
  const merged = new Map(existing.map((turn) => [turn.id, turn]));
  for (const turn of incoming) {
    const stored = merged.get(turn.id);
    merged.set(turn.id, {
      ...stored,
      ...turn,
      savedRecordId: turn.savedRecordId ?? stored?.savedRecordId,
    });
  }
  return Array.from(merged.values())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-20);
}
