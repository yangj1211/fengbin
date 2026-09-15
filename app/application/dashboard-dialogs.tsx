'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Info, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Inputs } from './model';
import {
  energyDates,
  energyProcess,
  energyReference,
  productionDates,
  productModel,
  formatFinal as f,
  getFinalEnergy,
} from './final-data';
import { storageMessage } from './store';
import { supplierRules } from './fixed-rules';

function CloseIcon({ label }: { label: string }) {
  return (
    <DialogClose
      render={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="dashboard-dialog-close"
          aria-label={label}
        />
      }
    >
      <X aria-hidden="true" />
    </DialogClose>
  );
}
function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <dt>{title}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function DashboardRules({
  id,
}: {
  id: 'energy' | 'production' | 'supplier';
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="ghost" size="sm" />}
      >
        <Info size={15} aria-hidden="true" />
        指标规则
      </DialogTrigger>
      <DialogContent
        className="app-dialog dashboard-dialog"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>指标规则</DialogTitle>
          <DialogDescription>
            {id === 'energy'
              ? '能源预测与优化'
              : id === 'production'
                ? '生产洞察与预警'
                : '供应商绩效评估'}
            的计算口径与提醒标准。
          </DialogDescription>
        </DialogHeader>
        <CloseIcon label="关闭指标规则" />
        <div className="dashboard-dialog-body">
          <dl className="dashboard-rule-list">
            {id === 'energy' ? (
              <>
                <Rule title="数据范围">
                  {energyDates[0]}—{energyDates.at(-1)}
                  ，来源为用电记录表与班次生产表。 工序为 {energyProcess}
                  ，产品为 {productModel}。
                </Rule>
                <Rule title="总用电与产量">
                  先按生产日、班次和工序合并两块电表电量，再关联班次产量。总用电包含零产量班次，产量按班次计一次。
                </Rule>
                <Rule title="生产单耗">
                  正产量且用电记录完整的班次：汇总电量 ÷ 汇总产量 × 1000，单位
                  kWh/千件。A/B 班分别加权计算。
                </Rule>
                <Rule title="单耗偏高">
                  历史参考为 {f(energyReference, 4)} kWh/千件，来自{' '}
                  {energyDates[0]}—{energyDates.at(-1)}{' '}
                  的正产量班次。单耗严格超过参考 20%
                  时提醒，等于边界不触发；筛选日期不会改变这个参考。该参考不是客户提供的能耗标准。
                </Rule>
                <Rule title="零产量用电">
                  产量为 0 的班次用电单列，生产单耗不可计算；不作为 0
                  单耗，也不并入正产量班次单耗。
                </Rule>
                <Rule title="统计范围">
                  A 班 08:00—20:00，B 班 20:00—次日
                  08:00，按开始所在生产日归属。小时趋势只展示电量；电表没有独立产量，电量分布不代表设备效率。
                </Rule>
              </>
            ) : id === 'production' ? (
              <>
                <Rule title="数据范围">
                  {productionDates[0]}—{productionDates.at(-1)}
                  ，来源为生产、停线、在制与节拍四张表。
                  按报表生产日筛选，跨午夜的停线与快照保留其所属生产日。
                </Rule>
                <Rule title="产量与计划完成率">
                  工序报工产量使用生产表的产量；计划完成率 = 报工产量 ÷ 报表计划
                  × 100%。各工序分别计算，不累计为成品总产量。
                </Rule>
                <Rule title="检验质量">
                  检验良率 = 合格数 ÷ 检验数 × 100%；不良率 = 不良数 ÷ 检验数 ×
                  100%。合格数 +
                  不良数不等于检验数时保留原数，数量差额单独标记，不自动补入不良。
                </Rule>
                <Rule title="业务异常">
                  计划完成率低于 95%，或不良率超过
                  2%，任一项触发即提示异常。等于阈值不触发。提醒用于核查，不代表已确认原因或处理完成。
                </Rule>
                <Rule title="累计停线">
                  按停线单号累计机台事件分钟数，跨午夜仍归属原生产日。机台事件累计不等于全厂停产时长。
                </Rule>
                <Rule title="时点在制">
                  仅汇总同一实际统计时点、同一工序的记录；不同工序分别列示。无快照显示无记录，不按
                  0 处理，不跨时点累计。
                </Rule>
                <Rule title="节拍核查">
                  保留原表节拍及计算、机台编码核查标记。表内实际产量对应检验数，不替代报工产量；缺少实测运行时间，不计算实测效率或
                  OEE。
                </Rule>
              </>
            ) : (
              <>
                <Rule title="综合评分">
                  交付及时率 × {supplierRules.deliveryWeight}% + 来料合格率 ×{' '}
                  {supplierRules.qualityWeight}% + 响应评分 × 20%，满分 100 分。
                </Rule>
                <Rule title="平均综合评分">
                  当前范围各供应商综合评分的算术平均。
                </Rule>
                <Rule title="交付与质量风险">
                  交付及时率低于 {supplierRules.deliveryTarget}%
                  为交付风险，来料合格率低于 {supplierRules.qualityTarget}%
                  为质量风险。
                  等于目标视为达标；风险与综合评分独立判断，规则固定。
                </Rule>
                <Rule title="风险分布">
                  每家供应商仅归入一种状态：未触发风险、仅交付风险、仅质量风险、交付与质量风险。
                  顶部两项风险数量分别统计，同一家供应商可能同时计入两项。
                </Rule>
                <Rule title="数据范围">
                  指标来自供应商评估汇总。当前资料不包含订单、批次、数量或交期明细。
                </Rule>
              </>
            )}
          </dl>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            关闭
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ForecastConditions({
  input,
  onApply,
}: {
  input: Inputs;
  onApply: (patch: Inputs) => boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" size="sm" variant="outline" />}
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        预测条件
      </DialogTrigger>
      {open && (
        <ForecastForm
          input={input}
          onApply={onApply}
          onClose={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}

function ForecastForm({
  input,
  onApply,
  onClose,
}: {
  input: Inputs;
  onApply: (patch: Inputs) => boolean;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState(input.plannedProduction);
  const [period, setPeriod] = useState(input.period);
  const [error, setError] = useState('');
  const [invalidPlan, setInvalidPlan] = useState(false);
  const formId = useId(),
    field = useRef<HTMLInputElement>(null);
  const d = getFinalEnergy({ ...input, plannedProduction: plan });
  const invalid = plan.trim() !== '' && d.plan === null;
  function apply(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || field.current?.validity.badInput) {
      setError('计划产量请输入大于或等于 0 的数值。');
      setInvalidPlan(true);
      field.current?.focus();
      return;
    }
    if (!onApply({ plannedProduction: plan.trim(), period })) {
      setError(storageMessage() || '条件保存失败，请重试。');
      return;
    }
    onClose();
  }
  return (
    <DialogContent
      className="app-dialog dashboard-dialog forecast-dialog"
      showCloseButton={false}
      initialFocus={field}
    >
      <DialogHeader>
        <DialogTitle>预测条件</DialogTitle>
        <DialogDescription>
          设置计划总产量，点击“应用”后更新仪表盘上的用电估算。
        </DialogDescription>
      </DialogHeader>
      <CloseIcon label="关闭预测条件" />
      <form
        id={formId}
        className="dashboard-dialog-body"
        onSubmit={apply}
        noValidate
      >
        <dl className="forecast-scope">
          <Rule title="工序">{energyProcess}</Rule>
          <Rule title="参考班次">
            {input.shift === '全部班次' ? 'A/B 全部班次' : `${input.shift} 班`}
          </Rule>
          <Rule title="历史参考周期">
            {energyDates[0]}—{energyDates.at(-1)}
          </Rule>
          <Rule title="历史生产单耗">{f(d.estimateRate, 4)} kWh/千件</Rule>
        </dl>
        <div className="app-field forecast-plan-field">
          <Label htmlFor={`${formId}-plan`}>计划总产量</Label>
          <div className="input-affix">
            <Input
              ref={field}
              id={`${formId}-plan`}
              type="number"
              step="any"
              min="0"
              value={plan}
              placeholder="请输入计划件数"
              aria-invalid={invalidPlan}
              aria-describedby={`${formId}-help${error ? ` ${formId}-error` : ''}`}
              onChange={(e) => {
                setPlan(e.target.value);
                setError('');
                setInvalidPlan(false);
              }}
            />
            <span>件</span>
          </div>
          <p id={`${formId}-help`} className="dashboard-dialog-note">
            0 表示计划不生产；留空并应用可清除当前预测。
          </p>
        </div>
        <div className="forecast-history">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!d.rows.length}
            onClick={() => {
              setPlan(
                String(
                  Math.round(
                    (d.output /
                      Math.max(1, new Set(d.rows.map((r) => r.date)).size)) *
                      7,
                  ),
                ),
              );
              setPeriod('7');
              setError('');
              setInvalidPlan(false);
            }}
          >
            填入历史日均 × 7 天
          </Button>
          <p className="dashboard-dialog-note">
            按当前筛选 {input.dateFrom}—{input.dateTo}、{input.shift}{' '}
            的有记录日期计算日均产量。
          </p>
        </div>
        <div className="forecast-preview">
          <span>用电估算预览</span>
          <strong>
            {f(d.estimate, 3)}
            <small> kWh</small>
          </strong>
          <p>
            {d.plan === null
              ? '填写有效计划产量后显示预览'
              : `${f(d.plan)} 件 × ${f(d.estimateRate, 4)} kWh/千件 ÷ 1000`}
          </p>
        </div>
        <p className="dashboard-dialog-note">
          使用所选班次的历史正产量记录估算，未包含停产、待机用电。班次可在仪表盘顶部切换。
        </p>
      </form>
      {error && (
        <p
          className="form-error dashboard-dialog-error"
          id={`${formId}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          取消
        </DialogClose>
        <Button type="submit" form={formId}>
          应用
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
