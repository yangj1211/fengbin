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
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function validAnalysis(value: unknown): boolean {
  const a = value as Analysis | undefined;
  return Boolean(
    a &&
    typeof a.title === 'string' &&
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
function hydrate() {
  if (typeof window === 'undefined' || hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      snapshot = initial;
      error = '';
      return;
    }
    if (raw.length > 3000000) throw new Error();
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.datasets) ||
      parsed.datasets.length !== 5 ||
      parsed.datasets.some((d) => validateDataset(d)) ||
      new Set(parsed.datasets.map((d) => d.id)).size !== 5 ||
      !Array.isArray(parsed.records) ||
      parsed.records.length > 100 ||
      !parsed.drafts ||
      typeof parsed.drafts !== 'object'
    )
      throw new Error();
    parsed.records = parsed.records.filter(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        modules.some((m) => m.id === r.module) &&
        (r.state === '待跟进' || r.state === '已完成') &&
        typeof r.note === 'string' &&
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
          { ...defaultInputs[id as keyof typeof defaultInputs], ...draft },
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
            draft: {
              ...defaultInputs[m.id],
              ...turns.at(-1)?.inputs,
              question: '',
              ...draft,
            },
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
        session.turns = session.turns.filter(validTurn).slice(-20);
        session.draft = { ...defaultInputs[session.module], ...session.draft };
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
    snapshot = parsed;
    error = '';
  } catch {
    snapshot = { ...initial };
    error = '本地数据无法读取，已使用初始工作区。原始存储尚未改动。';
  }
}
function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) {
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
  hydrated = false;
  hydrate();
  const next = update(snapshot);
  try {
    const serialized = JSON.stringify(next);
    if (serialized.length > 3000000) throw new Error();
    localStorage.setItem(STORAGE_KEY, serialized);
    snapshot = next;
    error = '';
    notify();
    return true;
  } catch {
    error = '当前浏览器无法保存，可能是存储空间不足。请导出数据后再试。';
    notify();
    return false;
  }
}
