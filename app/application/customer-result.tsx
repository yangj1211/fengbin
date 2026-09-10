'use client';
import { Check, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Analysis } from './model';
import type { CustomerDecision } from './customer-types';
import { DataTable } from './ui';
import { SourceLink, AnswerSources } from './customer-sources';

export default function CustomerResult({
  analysis,
  decision,
  onDecision,
}: {
  analysis: Analysis;
  decision?: CustomerDecision;
  onDecision?: (value: CustomerDecision) => void;
}) {
  return (
    <div className="customer-result">
      <div className="customer-result-heading">
        <h2>{analysis.title}</h2>
        <p>{analysis.summary}</p>
      </div>
      <div className="customer-candidates">
        {analysis.customerCandidates?.map((candidate, index) => (
          <article className="customer-candidate" key={candidate.product.model}>
            <div className="candidate-heading">
              <span className="candidate-rank">{index + 1}</span>
              <div>
                <h3>{candidate.product.model}</h3>
                <p>
                  {candidate.product.application} · {candidate.product.voltage}{' '}
                  V / {candidate.product.capacity} μF /{' '}
                  {candidate.product.temperature}℃
                </p>
              </div>
              {onDecision && (
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    decision?.model === candidate.product.model &&
                    decision.action === 'adopt'
                      ? 'candidate-adopted'
                      : ''
                  }
                  onClick={() =>
                    onDecision({
                      model: candidate.product.model,
                      action:
                        decision?.model === candidate.product.model &&
                        decision.action === 'adopt'
                          ? 'hold'
                          : 'adopt',
                      updatedAt: new Date().toISOString(),
                    })
                  }
                >
                  {decision?.model === candidate.product.model &&
                  decision.action === 'adopt' ? (
                    <>
                      <Check size={14} />
                      已采用
                    </>
                  ) : (
                    '采用建议'
                  )}
                </Button>
              )}
            </div>
            <ul className="candidate-reasons">
              {candidate.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <div className="candidate-sources">
              {candidate.sources.map((source) => (
                <SourceLink key={source.sectionId} source={source} />
              ))}
            </div>
          </article>
        ))}
      </div>
      {Boolean(analysis.customerExclusions?.length) && (
        <div className="customer-exclusions">
          <h3>未入选原因</h3>
          {analysis.customerExclusions!.map((item) => (
            <div key={item.model}>
              <strong>{item.model}</strong>
              <p>{item.reason}</p>
              <SourceLink source={item.source} />
            </div>
          ))}
        </div>
      )}
      {analysis.rows.length > 0 && (
        <details
          className="customer-comparison"
          open={analysis.rows.length > 1}
        >
          <summary>关键参数对比</summary>
          <DataTable columns={analysis.columns} rows={analysis.rows} />
        </details>
      )}
      <div className="customer-manual-check">
        <CircleAlert size={18} />
        <p>{analysis.recommendation}</p>
      </div>
      {decision && (
        <output className="customer-decision">
          {decision.action === 'adopt'
            ? `已采用 ${decision.model} 的建议，仍需人工完成规格复核。`
            : `已撤回对 ${decision.model} 的采用。`}
          处理记录保留在本次对话中。
        </output>
      )}
      <AnswerSources sources={analysis.sources} />
    </div>
  );
}
