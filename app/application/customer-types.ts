export type SourceReference = {
  documentId: string;
  sectionId: string;
  page: number;
};
export type CustomerProduct = {
  model: string;
  application: string;
  voltage: number;
  capacity: number;
  temperature: number;
  life: number;
  diameter: number;
  height: number;
  ripple: number;
  leadDays: number;
  source: SourceReference;
};
export type CustomerCandidate = {
  product: CustomerProduct;
  reasons: string[];
  sources: SourceReference[];
};
export type CustomerDecision = {
  model: string;
  action: 'adopt' | 'hold';
  updatedAt: string;
};
export type CustomerFixtures = {
  version: string;
  documents: {
    id: string;
    fileName: string;
    url: string;
    kind: string;
    summary: string;
    sections: { id: string; title: string; page: number; text: string }[];
  }[];
  products: CustomerProduct[];
  replacements: {
    from: string;
    to: string[];
    caveat: string;
    requirements: {
      application: string;
      voltage: number;
      capacity: number;
      temperature: number;
      life: number;
    };
    source: SourceReference;
  }[];
  cases: {
    id: string;
    title: string;
    question: string;
    recommendedModels: string[];
    source: SourceReference;
  }[];
};
