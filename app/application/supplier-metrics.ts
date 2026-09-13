import type { Inputs, Row } from './model';
import { supplierRules } from './fixed-rules';

export function supplierScore(row: Row, _input: Inputs): number {
  const input = supplierRules;
  const delivery = Number(input.deliveryWeight) / 100;
  const quality = Number(input.qualityWeight) / 100;
  return (
    Number(row['交付及时率(%)']) * delivery +
    Number(row['来料合格率(%)']) * quality +
    Number(row['响应评分']) * (1 - delivery - quality)
  );
}

export function supplierRisk(row: Row, _input: Inputs) {
  const input = supplierRules;
  return {
    delivery: Number(row['交付及时率(%)']) < Number(input.deliveryTarget),
    quality: Number(row['来料合格率(%)']) < Number(input.qualityTarget),
  };
}
