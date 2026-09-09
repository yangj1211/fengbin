'use client';
import { ArrowUpRight } from 'lucide-react';
import { numberLabel as f, chartNumber } from './dashboard-data';

export type ChartItem = {
  name: string;
  value: number;
  comparison?: number;
  warning?: boolean;
};

export function ProductionChart({
  items,
  onSelect,
}: {
  items: ChartItem[];
  onSelect: (name: string) => void;
}) {
  const max =
    Math.max(
      1,
      ...items.flatMap((item) => [item.value, item.comparison ?? 0]),
    ) * 1.2;
  return (
    <>
      <div className="dashboard-chart-legend">
        <span>
          <i />
          实际产量
        </span>
        <span>
          <i className="muted" />
          计划产量
        </span>
        <span>
          <i className="warning" />
          需关注产线
        </span>
      </div>
      <div
        className="production-plot"
        aria-label="产线计划与实际产量，单位万只"
      >
        <div className="production-axis" aria-hidden="true">
          {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((v, i) => (
            <span key={i}>{chartNumber(v, max < 10 ? 2 : 1)}</span>
          ))}
        </div>
        <div className="production-plot-scroll">
          <div className="production-gridlines" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} />
            ))}
          </div>
          <div className="production-columns">
            {items.slice(0, 8).map((item) => (
              <button
                className="production-column"
                key={item.name}
                onClick={() => onSelect(item.name)}
                aria-label={`查看${item.name}明细，实际 ${f(item.value, 2)} 万只，计划 ${f(item.comparison ?? 0, 2)} 万只${item.warning ? '，需关注' : ''}`}
              >
                <span className="production-bar-pair" aria-hidden="true">
                  <span
                    className="production-bar planned"
                    style={{
                      height: `${((item.comparison ?? 0) / max) * 100}%`,
                    }}
                  />
                  <span
                    className={
                      'production-bar actual' + (item.warning ? ' warning' : '')
                    }
                    style={{ height: `${(item.value / max) * 100}%` }}
                  >
                    <b>{chartNumber(item.value)}</b>
                  </span>
                </span>
                <span className="production-column-name">
                  {item.name}
                  <ArrowUpRight size={13} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="dashboard-chart-note">
        单位：万只 · 点击柱形查看产线明细
        {items.length > 8 ? ' · 展示前 8 条产线' : ''}
      </p>
    </>
  );
}

export function SupplierRanking({
  items,
  onSelect,
}: {
  items: ChartItem[];
  onSelect: (name: string) => void;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  return (
    <>
      <div className="supplier-ranking-scale" aria-hidden="true">
        <span>综合评分</span>
        <span>满分 100</span>
      </div>
      <div className="supplier-ranking">
        {sorted.slice(0, 8).map((item, index) => (
          <button
            key={item.name}
            className="supplier-rank-row"
            onClick={() => onSelect(item.name)}
            aria-label={`第 ${index + 1} 名，${item.name}，综合评分 ${f(item.value, 2)} 分${item.warning ? '，需关注' : ''}，查看明细`}
          >
            <span className="supplier-rank-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="supplier-rank-content">
              <span className="supplier-rank-title">
                <span>
                  {item.name}
                  <ArrowUpRight size={13} />
                </span>
                <strong>
                  {f(item.value, 1)}
                  <small>分</small>
                </strong>
              </span>
              <span className="supplier-rank-track" aria-hidden="true">
                <i
                  className={item.warning ? 'warning' : ''}
                  style={{
                    width: `${Math.min(100, Math.max(0, item.value))}%`,
                  }}
                />
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="dashboard-chart-note">
        按综合评分排序 · 点击供应商查看评估明细
        {items.length > 8 ? ' · 展示前 8 家' : ''}
      </p>
    </>
  );
}
