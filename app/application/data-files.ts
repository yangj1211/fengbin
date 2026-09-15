import type { Dataset } from './model';
import { finalSourceDefinitions } from './final-data';

// File entries and answer references share the same dataset identifiers.
export const dataFiles = [
  {
    tableId: 'energy-details',
    datasetId: 'energy',
    name: '用电明细.csv',
    url: '/data/energy/用电明细.csv',
  },
  {
    tableId: 'production',
    datasetId: 'production',
    name: '产线生产日报.csv',
    url: '/data/production/产线生产日报.csv',
  },
  {
    tableId: 'suppliers',
    datasetId: 'suppliers',
    name: '供应商交付与质量.csv',
    url: '/data/supplier/供应商交付与质量.csv',
  },
  ...finalSourceDefinitions.map((s) => ({
    tableId: s.id,
    datasetId: s.module,
    name: `${s.name}.csv`,
    url: `/data/final/${s.name}.csv`,
  })),
] as const;
export type DataFile = (typeof dataFiles)[number] & { sourceRow?: number };

export function findDataFile(href: string): DataFile | undefined {
  let path: string;
  try {
    path = decodeURI(href.split(/[?#]/)[0]);
  } catch {
    return undefined;
  }
  if (path === '/sample-data/energy/示例用电明细.csv') return dataFiles[0];
  const file = dataFiles.find((file) => file.url === path);
  const row = Number(
    new URLSearchParams(href.split('?')[1]?.split('#')[0]).get('row'),
  );
  return file && Number.isInteger(row) && row >= 2
    ? { ...file, sourceRow: row }
    : file;
}

export function datasetReference(
  dataset: Dataset | undefined,
  fallback: string,
) {
  const file =
    dataset?.origin === 'sample'
      ? dataFiles.find((item) => item.datasetId === dataset.id)
      : undefined;
  if (file) return `[${file.name}](${encodeURI(file.url)})`;
  return (dataset?.fileName || dataset?.name || fallback).replace(
    /[\\`*_{}[\]()<>~|#!]/g,
    '\\$&',
  );
}
