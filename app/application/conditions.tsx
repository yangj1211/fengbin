'use client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Field, Choice } from './ui';
import type { ModuleId, Inputs, Dataset } from './model';
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
      value={input[key]}
      options={Array.from(new Set(options))}
      onChange={(v) => change(key, v)}
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
          {choice(
            'application',
            '应用场景',
            Array.from(new Set(dataset.rows.map((r) => String(r['应用'])))),
          )}
          <div className="field-pair">
            {numeric('voltage', '最低额定电压', 'V')}
            {numeric('capacity', '标称容量', 'μF')}
          </div>
          <div className="field-pair">
            {numeric('temperature', '工作温度', '℃')}
            {numeric('life', '最低寿命', 'h')}
          </div>
        </>
      )}
      {id === 'maintenance' && (
        <>
          {choice(
            'device',
            '故障设备',
            Array.from(
              new Set(dataset.rows.map((r) => String(r['设备类型']))),
            ).map(
              (type) =>
                (
                  ({
                    卷绕机: '卷绕机 W-03',
                    含浸机: '含浸机 I-02',
                    老化柜: '老化柜 A-06',
                  }) as Record<string, string>
                )[type] ?? type,
            ),
          )}
          {choice(
            'symptom',
            '故障现象',
            Array.from(new Set(dataset.rows.map((r) => String(r['故障现象'])))),
          )}
          {choice('priority', '处理优先级', ['正常', '优先', '紧急'])}
          <div className="form-inline-note">
            排查方案由设备类型与故障分类关联知识条目。
          </div>
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
            以数据管理中的近 7 天用电为基准，按产量变化估算。
          </div>
        </>
      )}
      {id === 'production' && (
        <>
          {choice('line', '产线范围', [
            '全部产线',
            ...dataset.rows.map((r) => String(r['产线'])),
          ])}
          {numeric('completion', '计划完成率目标', '%')}
          {numeric('defect', '不良率预警阈值', '%')}
          <div className="form-inline-note">
            任意一项指标偏离目标，即提示关注。
          </div>
        </>
      )}
      {id === 'supplier' && (
        <>
          {choice('supplier', '评估范围', [
            '全部供应商',
            ...dataset.rows.map((r) => String(r['供应商'])),
          ])}
          <div className="field-pair">
            {numeric('deliveryTarget', '交付目标', '%')}
            {numeric('qualityTarget', '质量目标', '%')}
          </div>
          <div className="form-subtitle">评分权重</div>
          <div className="field-pair">
            {numeric('deliveryWeight', '交付权重', '%')}
            {numeric('qualityWeight', '质量权重', '%')}
          </div>
          <div className="form-inline-note">
            响应权重：
            {Math.max(
              0,
              100 -
                Number(input.deliveryWeight || 0) -
                Number(input.qualityWeight || 0),
            )}
            %。三项权重合计 100%。
          </div>
        </>
      )}
      <div className="app-field">
        <Label htmlFor="business-notes">
          {id === 'maintenance' ? '故障补充描述' : '业务备注'}
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
