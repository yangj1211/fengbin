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
const initial: WorkspaceState = {
  version: 1,
  records: [],
  datasets: initialDatasets,
  drafts: {},
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
    parsed.conversations = Object.fromEntries(
      Object.entries(parsed.conversations ?? {})
        .filter(
          ([id, turns]) =>
            modules.some((m) => m.id === id) && Array.isArray(turns),
        )
        .map(([id, turns]) => [
          id,
          turns
            .filter(
              (t) =>
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
            )
            .slice(-20),
        ]),
    );
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
