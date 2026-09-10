import customer from './customer-fixtures.json';
import maintenance from './maintenance-fixtures.json';
import type { CustomerFixtures, SourceReference } from './customer-types';

export type SourceDocument = CustomerFixtures['documents'][number];
export const sourceDocuments: SourceDocument[] = [
  ...customer.documents,
  ...maintenance.documents,
];
export function documentsFor(module: 'customer' | 'maintenance') {
  return module === 'customer' ? customer.documents : maintenance.documents;
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
