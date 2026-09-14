'use client';
import { useSyncExternalStore } from 'react';
import {
  initialDatasets,
  modules,
  defaultInputs,
  STORAGE_KEY,
  validateDataset,
  type WorkspaceState,
  type Analysis,
} from './model';
import type { ConversationTurn } from './conversation';
import { resolveSource } from './knowledge-sources';
import type { SourceReference } from './customer-types';
import type { CustomerDecision } from './customer-types';
import { normalizeCustomerInputs } from './customer-engine';
import { normalizeMaintenanceInputs } from './maintenance-engine';
import { withFixedRules } from './fixed-rules';
function validSources(sources: unknown): boolean {
  return (
    sources === undefined ||
    (Array.isArray(sources) &&
      sources.length <= 30 &&
      sources.every(
        (s) =>
          s &&
          typeof s.documentId === 'string' &&
          typeof s.sectionId === 'string' &&
          Number.isInteger(s.page) &&
          resolveSource(s as SourceReference),
      ))
  );
}
function validDecision(value: CustomerDecision | undefined) {
  return (
    value === undefined ||
    Boolean(
      value &&
      typeof value.model === 'string' &&
      (value.action === 'adopt' || value.action === 'hold') &&
      typeof value.updatedAt === 'string',
    )
  );
}
const initial: WorkspaceState = {
  version: 1,
  records: [],
  datasets: initialDatasets,
  drafts: {},
  sessions: [],
  activeSessionIds: {},
};
let snapshot = initial;
let hydrated = false;
let error = '';
let workspaceUserKey: string | null = null;
let userReady = false;
const DEFAULT_ADMIN_KEY = `${STORAGE_KEY}.user.default-admin`;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function validAnalysis(value: unknown): boolean {
  const a = value as Analysis | undefined;
  return Boolean(
    a &&
    typeof a.title === 'string' &&
    validSources(a.sources) &&
    (a.customerCandidates === undefined ||
      (Array.isArray(a.customerCandidates) &&
        a.customerCandidates.every(
          (c) =>
            c &&
            c.product &&
            typeof c.product.model === 'string' &&
            [
              'voltage',
              'capacity',
              'temperature',
              'life',
              'diameter',
              'height',
              'leadDays',
              'ripple',
            ].every((k) =>
              Number.isFinite(c.product[k as keyof typeof c.product]),
            ) &&
            typeof c.product.application === 'string' &&
            Array.isArray(c.reasons) &&
            c.reasons.every((r) => typeof r === 'string') &&
            validSources(c.sources),
        ))) &&
    (a.customerExclusions === undefined ||
      (Array.isArray(a.customerExclusions) &&
        a.customerExclusions.every(
          (c) =>
            c &&
            typeof c.model === 'string' &&
            typeof c.reason === 'string' &&
            validSources([c.source]),
        ))) &&
    typeof a.summary === 'string' &&
    typeof a.recommendation === 'string' &&
    typeof a.chartTitle === 'string' &&
    Array.isArray(a.columns) &&
    a.columns.every((c) => typeof c === 'string') &&
    Array.isArray(a.rows) &&
    a.rows.every(
      (row) => Array.isArray(row) && row.every((c) => typeof c === 'string'),
    ) &&
    Array.isArray(a.basis) &&
    a.basis.every((b) => typeof b === 'string') &&
    Array.isArray(a.metrics) &&
    a.metrics.every(
      (m) =>
        m &&
        typeof m.label === 'string' &&
        typeof m.value === 'string' &&
        typeof m.detail === 'string',
    ) &&
    Array.isArray(a.bars) &&
    a.bars.every(
      (b) =>
        b &&
        typeof b.label === 'string' &&
        Number.isFinite(b.value) &&
        typeof b.display === 'string',
    ) &&
    Array.isArray(a.steps) &&
    a.steps.every(
      (s) => s && typeof s.title === 'string' && typeof s.body === 'string',
    ),
  );
}
function validTurn(t: ConversationTurn): boolean {
  return Boolean(
    t &&
    typeof t.id === 'string' &&
    typeof t.question === 'string' &&
    typeof t.answer === 'string' &&
    (t.processingSummary === undefined ||
      (typeof t.processingSummary === 'string' &&
        t.processingSummary.length <= 2000)) &&
    (t.status === undefined ||
      t.status === 'complete' ||
      t.status === 'stopped') &&
    validSources(t.sources) &&
    validDecision(t.customerDecision) &&
    (t.feedback === undefined ||
      t.feedback === null ||
      t.feedback === 'like' ||
      t.feedback === 'dislike') &&
    (t.missing === undefined ||
      (Array.isArray(t.missing) &&
        t.missing.every((m) => typeof m === 'string'))) &&
    typeof t.createdAt === 'string' &&
    typeof t.sourceName === 'string' &&
    (t.sourceOrigin === 'sample' || t.sourceOrigin === 'local') &&
    t.inputs &&
    typeof t.inputs === 'object' &&
    Object.values(t.inputs).every((v) => typeof v === 'string') &&
    (!t.analysis || validAnalysis(t.analysis)) &&
    (!t.savedRecordId || typeof t.savedRecordId === 'string'),
  );
}
function normalizeWorkspace(parsed: WorkspaceState): WorkspaceState {
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.datasets) ||
      parsed.datasets.length !== 5 ||
      !Array.isArray(parsed.records) ||
      parsed.records.length > 100 ||
      !parsed.drafts ||
      typeof parsed.drafts !== 'object'
    )
      throw new Error();
    // Built-in datasets can change columns between releases. Refresh them
    // before validating against today's schema; imported data stays untouched.
    parsed.datasets = parsed.datasets.map((d) =>
      d?.origin === 'sample' &&
      (d.id === 'products' || d.id === 'maintenance' || d.id === 'energy')
        ? initialDatasets.find((item) => item.id === d.id)!
        : d,
    );
    if (
      parsed.datasets.some((d) => validateDataset(d)) ||
      new Set(parsed.datasets.map((d) => d.id)).size !== 5
    )
      throw new Error();
    parsed.deletedDataResourceIds = Array.isArray(parsed.deletedDataResourceIds)
      ? [
          ...new Set(
            parsed.deletedDataResourceIds.filter(
              (id) => typeof id === 'string' && id.length <= 200,
            ),
          ),
        ].slice(0, 1000)
      : [];
    parsed.records = parsed.records.filter(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        modules.some((m) => m.id === r.module) &&
        (r.state === '待跟进' || r.state === '已完成') &&
        typeof r.note === 'string' &&
        validDecision(r.customerDecision) &&
        typeof r.sourceName === 'string' &&
        Object.values(r.inputs ?? {}).every((v) => typeof v === 'string') &&
        typeof r.name === 'string' &&
        typeof r.createdAt === 'string' &&
        r.inputs &&
        validAnalysis(r.analysis),
    );
    parsed.drafts = Object.fromEntries(
      Object.entries(parsed.drafts)
        .filter(
          ([id, draft]) =>
            modules.some((m) => m.id === id) &&
            draft &&
            Object.values(draft).every((v) => typeof v === 'string'),
        )
        .map(([id, draft]) => [
          id,
          id === 'maintenance'
            ? normalizeMaintenanceInputs(draft)
            : withFixedRules(id as keyof typeof defaultInputs, {
                ...defaultInputs[id as keyof typeof defaultInputs],
                ...draft,
              }),
        ]),
    );
    if (!Array.isArray(parsed.sessions)) {
      parsed.sessions = modules.flatMap((m) => {
        const turns = (
          Array.isArray(parsed.conversations?.[m.id])
            ? parsed.conversations![m.id]!
            : []
        )
          .filter(validTurn)
          .slice(-20);
        const draft = parsed.drafts[m.id];
        if (!turns.length && !draft) return [];
        const createdAt = turns[0]?.createdAt ?? new Date().toISOString();
        return [
          {
            id: 'legacy-' + m.id,
            module: m.id,
            title:
              turns[0]?.question.slice(0, 48) ||
              draft?.question?.slice(0, 48) ||
              '未发送的对话',
            createdAt,
            updatedAt: turns.at(-1)?.createdAt ?? createdAt,
            turns,
            draft:
              m.id === 'customer'
                ? normalizeCustomerInputs({
                    ...turns.at(-1)?.inputs,
                    question: '',
                    ...draft,
                  })
                : m.id === 'maintenance'
                  ? normalizeMaintenanceInputs({
                      ...turns.at(-1)?.inputs,
                      question: '',
                      ...draft,
                    })
                  : withFixedRules(m.id, {
                      ...defaultInputs[m.id],
                      ...turns.at(-1)?.inputs,
                      question: '',
                      ...draft,
                    }),
          },
        ];
      });
    } else {
      const seen = new Set<string>();
      parsed.sessions = parsed.sessions.filter((session) => {
        if (
          !session ||
          typeof session.id !== 'string' ||
          seen.has(session.id) ||
          !modules.some((m) => m.id === session.module) ||
          typeof session.title !== 'string' ||
          typeof session.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(session.createdAt)) ||
          typeof session.updatedAt !== 'string' ||
          !Number.isFinite(Date.parse(session.updatedAt)) ||
          !Array.isArray(session.turns) ||
          !session.draft ||
          typeof session.draft !== 'object' ||
          Object.values(session.draft).some((v) => typeof v !== 'string')
        )
          return false;
        seen.add(session.id);
        session.titleEdited = session.titleEdited === true;
        session.turns = session.turns.filter(validTurn).slice(-20);
        session.draft =
          session.module === 'customer'
            ? normalizeCustomerInputs(session.draft)
            : session.module === 'maintenance'
              ? normalizeMaintenanceInputs(session.draft)
              : withFixedRules(session.module, {
                  ...defaultInputs[session.module],
                  ...session.draft,
                });
        return true;
      });
    }
    parsed.activeSessionIds = Object.fromEntries(
      modules.flatMap((m) => {
        const sessions = parsed.sessions!.filter((s) => s.module === m.id);
        const active =
          sessions.find((s) => s.id === parsed.activeSessionIds?.[m.id]) ??
          sessions[0];
        return active ? [[m.id, active.id]] : [];
      }),
    );
    delete parsed.conversations;
    parsed.moduleViews = Object.fromEntries(
      modules.flatMap((m) => {
        const view = parsed.moduleViews?.[m.id];
        return view === 'chat' || view === 'dashboard' ? [[m.id, view]] : [];
      }),
    );
    parsed.drafts = {};
    return parsed;
}

type PersonalWorkspace = Pick<
  WorkspaceState,
  'version' | 'records' | 'drafts' | 'sessions' | 'activeSessionIds' | 'moduleViews'
>;

function personalWorkspace(state: WorkspaceState): PersonalWorkspace {
  return {
    version: 1,
    records: state.records,
    drafts: state.drafts,
    sessions: state.sessions ?? [],
    activeSessionIds: state.activeSessionIds ?? {},
    moduleViews: state.moduleViews ?? {},
  };
}
function sharedWorkspace(state: WorkspaceState) {
  return {
    version: 1,
    datasets: state.datasets,
    deletedDataResourceIds: state.deletedDataResourceIds ?? [],
  };
}
function parseStored(raw: string): Record<string, unknown> {
  if (raw.length > 3000000) throw new Error();
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error();
  return parsed;
}
function serializeStored(value: unknown): string {
  const raw = JSON.stringify(value);
  if (raw.length > 3000000) throw new Error();
  return raw;
}
function hydrate() {
  if (typeof window === 'undefined' || hydrated) return;
  hydrated = true;
  if (!workspaceUserKey) {
    snapshot = initial;
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? parseStored(raw) : sharedWorkspace(initial);
    const shared = normalizeWorkspace({
      records: [],
      drafts: {},
      ...stored,
    } as WorkspaceState);
    // Keep a recoverable admin copy before removing legacy conversations from
    // the shared business-data record. A failed write never consumes the source.
    if (raw && ['records', 'drafts', 'sessions', 'conversations'].some(
      (key) => Object.hasOwn(stored, key),
    )) {
      const adminRaw = localStorage.getItem(DEFAULT_ADMIN_KEY);
      if (adminRaw === null) {
        localStorage.setItem(DEFAULT_ADMIN_KEY, serializeStored(personalWorkspace(shared)));
      } else {
        normalizeWorkspace({
          ...parseStored(adminRaw),
          datasets: shared.datasets,
        } as WorkspaceState);
      }
      localStorage.setItem(STORAGE_KEY, serializeStored(sharedWorkspace(shared)));
    }
    const personalRaw = localStorage.getItem(workspaceUserKey);
    const personal = personalRaw
      ? parseStored(personalRaw)
      : personalWorkspace(initial);
    snapshot = normalizeWorkspace({
      ...personal,
      datasets: shared.datasets,
      deletedDataResourceIds: shared.deletedDataResourceIds,
    } as WorkspaceState);
    error = '';
    userReady = true;
  } catch {
    snapshot = { ...initial };
    userReady = false;
    error = '当前账号的数据读取或迁移失败，原有记录仍保留，请重试。';
  }
}

/** Bind before mounting Workspace so another account never renders old chats. */
export function setWorkspaceUser(userId: string, isDefaultAdmin: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const key = userId.trim()
    ? isDefaultAdmin
      ? DEFAULT_ADMIN_KEY
      : `${STORAGE_KEY}.user.account.${encodeURIComponent(userId)}`
    : null;
  if (key && workspaceUserKey === key && userReady) return true;
  workspaceUserKey = key;
  snapshot = initial;
  hydrated = false;
  userReady = false;
  error = '';
  hydrate();
  notify();
  return userReady;
}
function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === workspaceUserKey || event.key === null) {
    hydrated = false;
    hydrate();
    notify();
  }
}
function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  hydrate();
  queueMicrotask(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}
export function useWorkspace() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initial,
  );
}
export function storageMessage() {
  return error;
}
export function updateWorkspace(
  update: (state: WorkspaceState) => WorkspaceState,
): boolean {
  if (!workspaceUserKey) {
    error = '请先登录后再保存。';
    return false;
  }
  hydrated = false;
  hydrate();
  if (!userReady) {
    notify();
    return false;
  }
  const next = update(snapshot);
  const written: { key: string; previous: string | null }[] = [];
  try {
    const changes = [
      { key: workspaceUserKey, value: serializeStored(personalWorkspace(next)) },
      { key: STORAGE_KEY, value: serializeStored(sharedWorkspace(next)) },
    ];
    for (const change of changes) {
      const previous = localStorage.getItem(change.key);
      if (previous === change.value) continue;
      localStorage.setItem(change.key, change.value);
      written.push({ key: change.key, previous });
    }
    snapshot = next;
    error = '';
    notify();
    return true;
  } catch {
    let restored = true;
    for (const { key, previous } of written.reverse()) {
      try {
        if (previous === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous);
      } catch {
        restored = false;
      }
    }
    if (!restored) {
      hydrated = false;
      hydrate();
    }
    error = restored
      ? '保存失败，存储空间可能不足。原有记录未改动。'
      : '部分内容未能保存，请核对当前记录后重试。';
    notify();
    return false;
  }
}
