import type { Dataset } from './model';

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
] as const;
export type DataFile = (typeof dataFiles)[number];

export function findDataFile(href: string) {
  let path: string;
  try {
    path = decodeURI(href.split(/[?#]/)[0]);
  } catch {
    return undefined;
  }
  if (path === '/sample-data/energy/示例用电明细.csv') return dataFiles[0];
  return dataFiles.find((file) => file.url === path);
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
    /[\\`*_{}\[\]()<>~|#!]/g,
    '\\$&',
  );
}
