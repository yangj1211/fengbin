import fixtures from './maintenance-fixtures.json';
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
