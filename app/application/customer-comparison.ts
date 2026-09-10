import type { Inputs } from './model';
import type { CustomerProduct } from './customer-types';

const number = (value: number) => value.toLocaleString('zh-CN');

export function customerParameterComparison(
  input: Inputs,
  product: CustomerProduct,
): string[] {
  const lines: string[] = [];
  if (input.application)
    lines.push(
      `应用方面，你的需求是${input.application}，产品适用${product.application}，${input.application === product.application ? '符合' : '不符合'}。`,
    );
  const parameters = [
    { key: 'voltage', label: '电压', unit: ' V', mode: 'min' },
    { key: 'capacity', label: '容量', unit: ' μF', mode: 'equal' },
    { key: 'temperature', label: '工作温度', unit: '℃', mode: 'min' },
    { key: 'life', label: '寿命', unit: ' h', mode: 'min' },
    { key: 'diameter', label: '直径', unit: ' mm', mode: 'max' },
    { key: 'height', label: '高度', unit: ' mm', mode: 'max' },
    { key: 'leadDays', label: '交期', unit: ' 天', mode: 'max' },
  ] as const;
  for (const { key, label, unit, mode } of parameters) {
    if (!input[key]?.trim() || !Number.isFinite(Number(input[key]))) continue;
    const requested = Number(input[key]);
    const actual = product[key];
    const matches =
      mode === 'equal'
        ? actual === requested
        : mode === 'min'
          ? actual >= requested
          : actual <= requested;
    const requirement =
      mode === 'equal' ? '为' : mode === 'min' ? '不低于' : '不超过';
    lines.push(
      `${label}要求${requirement} ${number(requested)}${unit}，${key === 'leadDays' ? '产品示例交期为' : '产品参数为'} ${number(actual)}${unit}，${matches ? '符合' : '不符合'}。`,
    );
  }
  return lines;
}
