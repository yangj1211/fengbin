import fixtures from './maintenance-fixtures.json';
import finalData from './maintenance-final.json';
import type { SourceReference, CustomerFixtures } from './customer-types';

export type MaintenanceCase = {
  id: string;
  title: string;
  device: string;
  model: string;
  code: string;
  symptom: string;
  keywords: string[];
  causes: string[];
  steps: string[];
  repair: string[];
  verification: string[];
  precautions: string[];
  parts: { name: string; condition: string }[];
  history: string;
  sources: SourceReference[];
};
export const maintenanceFixtures = fixtures as {
  documents: CustomerFixtures['documents'];
  cases: MaintenanceCase[];
};
export const maintenanceCases = maintenanceFixtures.cases;

export type MaintenanceCell = string | number | boolean | null;

export type MaintenanceTable = {
  id: string;
  fileName: string;
  sheetName: string;
  url: string;
  columns: string[];
  rows: MaintenanceCell[][];
};

export type MaintenanceImage = {
  faultId: string;
  fileName: string;
  url: string;
  width: number;
  height: number;
};

export type MaintenanceFault = {
  id: string;
  name: string;
  symptom: string | null;
  scope: string;
  version: string;
  imageFileName: string;
  row: number;
};

export type MaintenancePlan = {
  id: string;
  faultId: string;
  cause: string;
  repair: string;
  row: number;
};

export type MaintenanceStandard = {
  id: string;
  name: string;
  location: string;
  text: string;
  fileNumber: string;
  itemNumber: string;
  version: string;
  revisedAt: string;
  row: number;
};

export type MaintenancePart = {
  id: string;
  process: string;
  name: string;
  spec: string;
  unit: string;
  row: number;
};

export const maintenanceTables: MaintenanceTable[] = finalData.tables;
export const maintenanceImages: MaintenanceImage[] = finalData.images;

function rowsFor(id: string): MaintenanceCell[][] {
  const table = maintenanceTables.find((item) => item.id === id);
  if (!table) throw new Error(`Missing maintenance source table: ${id}`);
  return table.rows;
}

function sourceText(value: MaintenanceCell): string {
  // Required text fields come directly from the final source workbooks.
  if (typeof value !== 'string') throw new Error('Expected source text');
  return value;
}

export const maintenanceFaults: MaintenanceFault[] = rowsFor('maintenance-faults').map((cells, index) => ({
  id: sourceText(cells[0]),
  name: sourceText(cells[1]),
  symptom: cells[2] === null ? null : sourceText(cells[2]),
  scope: sourceText(cells[3]),
  version: sourceText(cells[4]),
  imageFileName: sourceText(cells[5]),
  row: index + 2,
}));

export const maintenancePlans: MaintenancePlan[] = rowsFor('maintenance-plans').map((cells, index) => ({
  id: sourceText(cells[0]),
  faultId: sourceText(cells[1]),
  cause: sourceText(cells[2]),
  repair: sourceText(cells[3]),
  row: index + 2,
}));

export const maintenanceStandards: MaintenanceStandard[] = rowsFor('maintenance-standards').map((cells, index) => ({
  id: sourceText(cells[0]),
  name: sourceText(cells[1]),
  location: sourceText(cells[2]),
  text: sourceText(cells[3]),
  fileNumber: sourceText(cells[4]),
  itemNumber: sourceText(cells[5]),
  version: sourceText(cells[6]),
  revisedAt: sourceText(cells[7]),
  row: index + 2,
}));

export const maintenanceParts: MaintenancePart[] = rowsFor('maintenance-parts-final').map((cells, index) => ({
  id: sourceText(cells[0]),
  process: sourceText(cells[1]),
  name: sourceText(cells[2]),
  spec: sourceText(cells[3]),
  unit: sourceText(cells[4]),
  row: index + 2,
}));

export const maintenanceExamples = [
  { title: '查故障与配图', question: '毛刷马达不转，怎么处理？有图片吗？' },
  { title: '查操作标准', question: '含浸机硅胶条用什么尺寸？' },
  { title: '查备件规格', question: '切纸刀有哪些规格和料号？' },
];
