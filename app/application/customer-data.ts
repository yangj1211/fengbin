import fixtures from './customer-fixtures.json';
import type { CustomerFixtures, SourceReference } from './customer-types';

export const customerFixtures = fixtures as CustomerFixtures;
export const customerProducts = customerFixtures.products;
export const specificationProducts = customerFixtures.specifications ?? [];
export const customerExamples = customerFixtures.cases;
export function sourceReference(
  documentId: string,
  sectionId: string,
): SourceReference {
  const section = customerFixtures.documents
    .find((d) => d.id === documentId)
    ?.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error('资料引用不存在：' + sectionId);
  return { documentId, sectionId, page: section.page };
}
export function resolveSource(ref: SourceReference) {
  const document = customerFixtures.documents.find(
    (d) => d.id === ref.documentId,
  );
  const section = document?.sections.find(
    (s) => s.id === ref.sectionId && s.page === ref.page,
  );
  return document && section ? { document, section } : null;
}
export function uniqueSources(refs: SourceReference[]) {
  return refs.filter(
    (ref, i) =>
      refs.findIndex(
        (r) => r.documentId === ref.documentId && r.sectionId === ref.sectionId,
      ) === i,
  );
}
