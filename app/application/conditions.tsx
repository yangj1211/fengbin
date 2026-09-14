'use client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Field, Choice } from './ui';
import type { ModuleId, Inputs, Dataset } from './model';
import {
  productionRuleDescription,
  supplierRuleDescription,
} from './fixed-rules';
export default function AnalysisConditions({
  id,
  input,
  dataset,
  change,
  disabled,
}: {
  id: ModuleId;
  input: Inputs;
  dataset: Dataset;
  change: (key: string, value: string) => void;
  disabled: boolean;
}) {
  const numeric = (key: string, label: string, suffix: string) => (
    <Field
      name={id + '-' + key}
      label={label}
      type="number"
      value={input[key]}
      onChange={(v) => change(key, v)}
      suffix={suffix}
    />
  );
  const choice = (key: string, label: string, options: string[]) => (
    <Choice
      name={id + '-' + key}
      label={label}
      value={input[key] || (options.includes('') ? '未指定' : '')}
      options={Array.from(new Set(options.map(value => value || '未指定')))}
      onChange={(v) => change(key, v === '未指定' ? '' : v)}
    />
  );
  return (
    <fieldset
      disabled={disabled}
      className="business-fields chat-condition-fields"
    >
      {id === 'customer' && (
        <>
          <Field
            name="customer-name"
            label="客户名称"
            value={input.customer}
            onChange={(v) => change('customer', v)}
          />
          <Field
            name="customer-application"
            label="应用场景"
            value={input.application ?? ''}
            onChange={(v) => change('application', v)}
          />
          <div className="field-pair">
            {numeric('voltage', '最低额定电压', 'V')}
            {numeric('capacity', '标称容量', 'μF')}
          </div>
          <div className="field-pair">
            {numeric('temperature', '工作温度', '℃')}
            {numeric('life', '最低试验时间（选填）', 'h')}
          </div>
          <div className="field-pair">
            {numeric('diameter', '本体直径上限（含公差）', 'mm')}
            {numeric('height', '本体长度上限（不含引脚）', 'mm')}
          </div>
          <div className="field-pair">
            {choice('lifeType', '寿命测试类型', ['', 'Endurance', 'Useful Life'])}
            {choice('mounting', '安装方式', ['', 'THT', 'SMD', 'Snap-In'])}
          </div>
          <Field
            name="customer-replacement"
            label="需替代的型号（选填）"
            value={input.replacement ?? ''}
            onChange={(v) => change('replacement', v.toUpperCase())}
          />
        </>
      )}
      {id === 'energy' && (
        <>
          {choice('process', '工序范围', [
            '全部工序',
            ...dataset.rows.map((r) => String(r['工序'])),
          ])}
          {choice('period', '预测周期（天）', ['7', '14', '30'])}
          {numeric('change', '计划产量变化', '%')}
          <div className="form-inline-note">
            以当前资料中的近 7 天用电为基准，按产量变化估算。
          </div>
        </>
      )}
      {id === 'production' && (
        <>
          {choice('line', '产线范围', [
            '全部产线',
            ...dataset.rows.map((r) => String(r['产线'])),
          ])}
          <div className="form-inline-note">
            {productionRuleDescription}当前规则固定，不支持修改。
          </div>
        </>
      )}
      {id === 'supplier' && (
        <>
          {choice('supplier', '评估范围', [
            '全部供应商',
            ...dataset.rows.map((r) => String(r['供应商'])),
          ])}
          <div className="form-inline-note">
            {supplierRuleDescription}当前规则固定，不支持修改。
          </div>
        </>
      )}
      <div className="app-field">
        <Label htmlFor="business-notes">
          业务备注
          <span className="optional-label">选填</span>
        </Label>
        <Textarea
          id="business-notes"
          value={input.notes}
          onChange={(e) => change('notes', e.target.value)}
          maxLength={2000}
          placeholder="补充需要保留的信息…"
          className="business-notes"
        />
        <p className="field-help">备注随记录保存，不参与当前规则计算。</p>
      </div>
    </fieldset>
  );
}
