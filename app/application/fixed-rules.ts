import type { Inputs, ModuleId } from './model';

export const productionRules = Object.freeze({ completion: '95', defect: '2' });
export const supplierRules = Object.freeze({
  deliveryTarget: '95',
  qualityTarget: '98',
  deliveryWeight: '40',
  qualityWeight: '40',
});

// Apply after merging drafts so older saved settings cannot change current rules.
export function withFixedRules(id: ModuleId, input: Inputs): Inputs {
  return id === 'production'
    ? { ...input, ...productionRules }
    : id === 'supplier'
      ? { ...input, ...supplierRules }
      : input;
}

export const productionRuleDescription =
  '完成率 = 实际产量 ÷ 计划产量 × 100%，低于 95% 提示异常；不良率 = 不良数量 ÷ 检验数量 × 100%，高于 2% 提示异常。任一项触发即为异常，等于阈值不触发。';
export const supplierRuleDescription =
  '综合评分 = 交付及时率 × 40% + 来料合格率 × 40% + 响应评分 × 20%，满分 100 分。交付及时率低于 95% 为交付风险，来料合格率低于 98% 为质量风险；等于目标视为达标，风险与评分独立判断。';
