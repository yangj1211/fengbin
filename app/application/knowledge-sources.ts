import customer from './customer-fixtures.json';
import maintenance from './maintenance-fixtures.json';
import { maintenanceTables, maintenanceImages, maintenanceFaults } from './maintenance-data';
import type { CustomerFixtures, SourceReference } from './customer-types';

export type SourceDocument = CustomerFixtures['documents'][number];
export const maintenanceSourceDocuments: SourceDocument[] = maintenanceTables.map((table) => ({
  id: table.id,
  fileName: table.fileName,
  url: table.url,
  kind: 'workbook',
  summary: `${table.sheetName} · ${table.rows.length} 条记录`,
  pages: [],
  sections: table.rows.map((row) => ({
    id: String(row[0]),
    title: String(row[0]),
    page: 1,
    text: table.columns.map((column, i) => `${column}：${row[i] ?? ''}`).join('\n'),
  })),
}));
const maintenanceImageDocuments: SourceDocument[] = maintenanceImages.map((image) => ({
  id: `maintenance-image-${image.faultId}`,
  fileName: image.fileName,
  url: image.url,
  kind: 'image',
  summary: `${maintenanceFaults.find((fault) => fault.id === image.faultId)?.name ?? image.faultId}参考图片`,
  pages: [{ page: 1, image: image.url, width: image.width, height: image.height }],
  sections: [{ id: image.faultId, title: image.faultId, page: 1, text: `故障 ${image.faultId} 对应的参考图片。` }],
}));
export const sourceDocuments: SourceDocument[] = [
  ...customer.documents,
  ...maintenance.documents,
  ...maintenanceSourceDocuments,
  ...maintenanceImageDocuments,
];
export function documentsFor(module: 'customer' | 'maintenance') {
  return module === 'customer'
    ? customer.documents.filter(document => document.id.startsWith('spec-'))
    : maintenanceSourceDocuments;
}
export function findSourceDocument(href: string) {
  let path: string;
  try {
    path = decodeURI(href.split(/[?#]/)[0]);
  } catch {
    return undefined;
  }
  return sourceDocuments.find((document) => {
    const historicalUrl = document.url
      .replace('/data/', '/sample-data/')
      .replace(/([^/]+)$/, '示例$1');
    return path === document.url || path === historicalUrl;
  });
}
export function resolveSource(ref: SourceReference) {
  const document = sourceDocuments.find((item) => item.id === ref.documentId);
  const section = document?.sections.find(
    (item) => item.id === ref.sectionId && item.page === ref.page,
  );
  return document && section ? { document, section } : null;
}
export function uniqueSources(refs: SourceReference[]) {
  return refs.filter(
    (ref, index) =>
      refs.findIndex(
        (item) =>
          item.documentId === ref.documentId &&
          item.sectionId === ref.sectionId &&
          item.page === ref.page,
      ) === index,
  );
}
