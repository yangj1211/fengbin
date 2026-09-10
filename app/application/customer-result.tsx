'use client';
import type { Analysis, Inputs } from './model';
import { AnswerSources } from './customer-sources';
import { customerParameterComparison } from './customer-comparison';

export default function CustomerResult({
  analysis,
  inputs,
}: {
  analysis: Analysis;
  inputs: Inputs;
}) {
  const lookup = analysis.title === '产品规格查询';
  return (
    <div className="customer-result">
      <p>{analysis.summary}</p>
      {!analysis.customerCandidates &&
        analysis.rows.map((row, index) => (
          <section className="customer-candidate" key={index}>
            <h3>
              {index + 1}. {row[0]}
            </h3>
            <p>
              {analysis.columns
                .slice(1)
                .map(
                  (label, column) => `${label}：${row[column + 1] ?? '未记录'}`,
                )
                .join('，')}
              。
            </p>
          </section>
        ))}
      {analysis.customerCandidates?.map((candidate, index) => {
        const product = candidate.product;
        const comparison = lookup
          ? []
          : customerParameterComparison(inputs, product);
        return (
          <section className="customer-candidate" key={product.model}>
            <h3>
              {index + 1}. {product.model}
            </h3>
            {comparison.length ? (
              <p>{comparison.join('')}</p>
            ) : (
              <p>
                这款产品适用于{product.application}，额定电压 {product.voltage}{' '}
                V，容量 {product.capacity} μF， 目录温度 {product.temperature}
                ℃，寿命 {product.life.toLocaleString('zh-CN')} h， 外形尺寸 Φ
                {product.diameter} × {product.height} mm，示例交期{' '}
                {product.leadDays} 天。
              </p>
            )}
            {candidate.reasons.slice(lookup ? 0 : 2).map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </section>
        );
      })}
      {Boolean(analysis.customerExclusions?.length) && (
        <section className="customer-exclusions">
          <h3>未入选原因</h3>
          {analysis.customerExclusions!.map((item) => (
            <p key={item.model}>
              <strong>{item.model}：</strong>
              {item.reason}。
            </p>
          ))}
        </section>
      )}
      <p className="customer-manual-check">{analysis.recommendation}</p>
      <AnswerSources sources={analysis.sources} legacy={!analysis.sources} />
    </div>
  );
}
