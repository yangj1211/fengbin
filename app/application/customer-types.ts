export type SourceReference = {
  documentId: string;
  sectionId: string;
  page: number;
};
export type SpecificationProduct = {
  model: string;
  mountingType: string;
  capacitanceUf: number;
  ratedVoltageV: number;
  temperatureMinC: number;
  temperatureMaxC: number;
  diameterNominalMm: number;
  diameterMaxMm: number | null;
  heightNominalMm: number;
  heightMaxMm: number | null;
  pitchMm: number | null;
  endurance: LifetimeSpecification;
  usefulLife: LifetimeSpecification | null;
  ripple: { currentA: number; frequencyHz: number; temperatureC: number }[];
  source: SourceReference;
};
export type LifetimeSpecification = {
  hours: number;
  temperatureC: number;
  voltageApplied: boolean;
  rippleApplied: boolean;
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
  specifications?: SpecificationProduct[];
  documents: {
    id: string;
    fileName: string;
    url: string;
    kind: string;
    summary: string;
    pages: { page: number; image: string; width: number; height: number }[];
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
