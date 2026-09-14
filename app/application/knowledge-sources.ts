import customer from './customer-fixtures.json';
import maintenance from './maintenance-fixtures.json';
import type { CustomerFixtures, SourceReference } from './customer-types';

export type SourceDocument = CustomerFixtures['documents'][number];
export const sourceDocuments: SourceDocument[] = [
  ...customer.documents,
  ...maintenance.documents,
];
export function documentsFor(module: 'customer' | 'maintenance') {
  return module === 'customer'
    ? customer.documents.filter(document => document.id.startsWith('spec-'))
    : maintenance.documents;
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
