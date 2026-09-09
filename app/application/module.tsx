'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  RotateCcw,
  Database,
  FilePlus2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AppHeading, Field, Choice } from './ui';
import AnalysisResult from './result';
import {
  analyze,
  defaultInputs,
  modules,
  validateInputs,
  type ModuleId,
  type Inputs,
  type WorkspaceState,
  type Analysis,
} from './model';
import { updateWorkspace, storageMessage } from './store';
export default function ModuleWorkspace({
  id,
  state,
  navigate,
}: {
  id: ModuleId;
  state: WorkspaceState;
  navigate: (path: string) => void;
}) {
  const m = modules.find((m) => m.id === id)!;
  const dataset = state.datasets.find((d) => d.id === m.dataset)!;
  const [edited, setEdited] = useState<Inputs | null>(null);
  const input = edited ?? state.drafts[id] ?? defaultInputs[id];
  const [result, setResult] = useState<{
    analysis: Analysis;
    inputs: Inputs;
    sourceName: string;
    sourceOrigin: 'sample' | 'local';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [recordName, setRecordName] = useState('');
  const [savedId, setSavedId] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function change(key: string, value: string) {
    setEdited({ ...input, [key]: value });
    setMessage('');
  }
  function run(event?: React.SubmitEvent<HTMLFormElement>) {
    event?.preventDefault();
    const error = validateInputs(id, input);
    if (error) {
      setMessage(error);
      return;
    }
    if (busy) return;
    setMessage('');
    setBusy(true);
    const captured = { ...input };
    timer.current = setTimeout(() => {
      try {
        setResult({
          analysis: analyze(id, captured, dataset),
          inputs: captured,
          sourceName: dataset.name,
          sourceOrigin: dataset.origin,
        });
        setSavedId('');
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : '分析未完成，请检查数据后重试。',
        );
      }
      setBusy(false);
    }, 220);
  }
  function saveDraft() {
    if (
      updateWorkspace((s) => ({
        ...s,
        drafts: { ...s.drafts, [id]: { ...input } },
      }))
    )
      setMessage('草稿已保存在当前浏览器。');
    else setMessage(storageMessage());
  }
  function save() {
    if (!result || !recordName.trim()) return;
    if (state.records.length >= 100) {
      setMessage('最多保存 100 份记录，请先导出并清理不再需要的记录。');
      setSaveOpen(false);
      return;
    }
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      module: id,
      name: recordName.trim().slice(0, 100),
      createdAt: new Date().toISOString(),
      inputs: result.inputs,
      analysis: result.analysis,
      sourceName: result.sourceName,
      sourceOrigin: result.sourceOrigin,
      state: '待跟进' as const,
      note: '',
    };
    if (updateWorkspace((s) => ({ ...s, records: [record, ...s.records] }))) {
      setSavedId(recordId);
      setSaveOpen(false);
      setMessage('分析已保存，可在分析记录中继续跟进。');
    } else setMessage(storageMessage());
  }
  const fallback = analyze(id, defaultInputs[id], dataset);
  const shown = result?.analysis ?? fallback;
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
      options={options}
      onChange={(v) => change(key, v)}
    />
  );
  return (
    <>
      <AppHeading
        title={m.name}
        description={m.description}
        action={
          <Button variant="outline" onClick={() => navigate('/records')}>
            <ArrowLeft size={15} />
            查看历史记录
          </Button>
        }
      />
      <div className={'business-layout module-' + id}>
        <section className="business-form-section">
          <div className="business-form-title">
            <div>
              <h2>{m.inputTitle}</h2>
              <p>
                {state.drafts[id]
                  ? '已载入最近保存的草稿'
                  : '填写本次分析的业务条件'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="重置条件"
              aria-label="重置条件"
              onClick={() => {
                setEdited({ ...defaultInputs[id] });
                setResult(null);
                setSavedId('');
                setMessage('');
              }}
              disabled={busy}
            >
              <RotateCcw size={16} />
            </Button>
          </div>
          <form onSubmit={run}>
            <fieldset disabled={busy} className="business-fields">
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
                    Array.from(
                      new Set(dataset.rows.map((r) => String(r['应用']))),
                    ),
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
                    Array.from(
                      new Set(dataset.rows.map((r) => String(r['故障现象']))),
                    ),
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
                <p className="field-help">
                  备注随记录保存，不参与当前规则计算。
                </p>
              </div>
            </fieldset>
            <div className="business-form-actions">
              <Button type="submit" disabled={busy}>
                {busy ? '正在分析数据…' : m.action}
                <ArrowRight size={15} />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={saveDraft}
                disabled={busy}
              >
                <Save size={15} />
                保存草稿
              </Button>
            </div>
          </form>
          <button
            className="form-data-source"
            onClick={() => navigate('/data')}
          >
            <Database size={16} />
            <span>
              {dataset.name}
              <small>
                {dataset.rows.length} 条 ·{' '}
                {dataset.origin === 'sample' ? '示例数据' : '本地导入'}
              </small>
            </span>
            <ArrowRight size={14} />
          </button>
        </section>
        <div className="business-output">
          {message && (
            <output className="app-message">
              {message}
              {savedId && (
                <button
                  className="inline-link"
                  onClick={() => navigate('/records/' + savedId)}
                >
                  打开记录
                  <ArrowRight size={13} />
                </button>
              )}
            </output>
          )}
          <section className="app-section">
            <div className="app-section-title">
              <h2>{result ? m.resultTitle : '当前数据概览'}</h2>
              {result ? (
                <Button
                  variant={savedId ? 'outline' : 'default'}
                  onClick={() => {
                    if (savedId) {
                      navigate('/records/' + savedId);
                      return;
                    }
                    setRecordName(
                      (id === 'customer'
                        ? result.inputs.customer + ' · '
                        : id === 'maintenance'
                          ? result.inputs.device + ' · '
                          : '') + m.resultTitle,
                    );
                    setSaveOpen(true);
                  }}
                  disabled={busy}
                >
                  {savedId ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <FilePlus2 size={15} />
                  )}{' '}
                  {savedId ? '已保存 · 查看' : '保存分析'}
                </Button>
              ) : (
                <span>提交条件后生成本次分析</span>
              )}
            </div>
            {busy && (
              <div className="analysis-progress">
                <Progress value={60} aria-label="数据分析进度" />
                <output>正在校验数据并应用分析规则…</output>
              </div>
            )}
            <AnalysisResult analysis={shown} module={id} />
          </section>
        </div>
      </div>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>保存分析记录</DialogTitle>
            <DialogDescription>
              保存本次输入与结果快照，后续可继续跟进或导出。
            </DialogDescription>
          </DialogHeader>
          <div className="app-field">
            <Label htmlFor="record-name">记录名称</Label>
            <Input
              id="record-name"
              value={recordName}
              onChange={(e) => setRecordName(e.target.value)}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            <Button disabled={!recordName.trim()} onClick={save}>
              保存记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
