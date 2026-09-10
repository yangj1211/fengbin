'use client';
import { Check, Lightbulb, FileCheck2, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, EmptyState } from './ui';
import type { Analysis, ModuleId } from './model';
import type { CustomerDecision } from './customer-types';
import CustomerResult from './customer-result';
export default function AnalysisResult({
  analysis,
  module,
  decision,
  onDecision,
}: {
  analysis: Analysis;
  module: ModuleId;
  decision?: CustomerDecision;
  onDecision?: (value: CustomerDecision) => void;
}) {
  if (module === 'customer' && analysis.customerCandidates)
    return (
      <CustomerResult
        analysis={analysis}
        decision={decision}
        onDecision={onDecision}
      />
    );
  return (
    <div className={'analysis-result result-' + module}>
      <div className="analysis-conclusion">
        <span>
          <FileCheck2 size={21} />
        </span>
        <div>
          <h2>{analysis.title}</h2>
          <p>{analysis.summary}</p>
        </div>
      </div>
      <div className="analysis-metrics">
        {analysis.metrics.map((m) => (
          <div key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <p>{m.detail}</p>
          </div>
        ))}
      </div>
      <Tabs defaultValue="result" className="business-tabs">
        <TabsList variant="line">
          <TabsTrigger value="result">
            {module === 'maintenance' ? '排查方案' : '分析明细'}
          </TabsTrigger>
          <TabsTrigger value="basis">计算与判断依据</TabsTrigger>
        </TabsList>
        <TabsContent value="result">
          {analysis.empty ? (
            <EmptyState
              title="暂无匹配结果"
              description="请调整条件或补充相关数据，再重新分析。"
            />
          ) : (
            <>
              {analysis.bars.length > 0 && (
                <section className="business-chart">
                  <h3>
                    <BarChart3 size={17} />
                    {analysis.chartTitle}
                  </h3>
                  {module === 'energy' ? (
                    <div className="energy-columns">
                      {analysis.bars.map((b) => (
                        <div key={b.label}>
                          <strong>{b.display}</strong>
                          <div className="energy-column-track">
                            <span style={{ height: b.value + '%' }} />
                          </div>
                          <span>{b.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="business-bars">
                      {analysis.bars.map((b) => (
                        <div key={b.label}>
                          <span>{b.label}</span>
                          <div className="business-bar-track">
                            <i
                              className={b.warning ? 'warning' : ''}
                              style={{
                                width:
                                  Math.max(0, Math.min(100, b.value)) + '%',
                              }}
                            />
                          </div>
                          <strong>{b.display}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {module === 'maintenance' && (
                <ol className="repair-steps">
                  {analysis.steps.map((s, i) => (
                    <li key={s.title}>
                      <span>{i + 1}</span>
                      <div>
                        <h3>{s.title}</h3>
                        <p>{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="business-detail-table">
                <DataTable columns={analysis.columns} rows={analysis.rows} />
              </div>
            </>
          )}
          <div className="business-recommendation">
            <Lightbulb size={19} />
            <div>
              <h3>后续建议</h3>
              <p>{analysis.recommendation}</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="basis">
          <div className="analysis-basis">
            {analysis.basis.map((text, i) => (
              <div key={text}>
                <span>
                  <Check size={15} />
                </span>
                <div>
                  <h3>
                    {i === 0 ? '数据来源' : i === 1 ? '处理方式' : '判断依据'}
                  </h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
