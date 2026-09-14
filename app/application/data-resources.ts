import { type ModuleId, type WorkspaceState } from './model';

export type DataTableAsset = {
  id: string;
  name: string;
  comment: string;
  module: ModuleId;
  columns: string[];
  rows: (string | number)[][];
};

const tableComments: Record<string, string> = {
  products:
    '记录客户规格书中的型号、额定电压、容量、温区、安装方式、耐久试验条件及本体尺寸公差上限。',
  maintenance: '记录设备类型、故障现象、排查方向及处理建议，用于设备维修问答。',
  energy: '按工序汇总用电量、产量及基准单耗，用于工序能耗分析。',
  production: '记录各产线的计划产量、实际产量、检验数量、不良数量及停机时长。',
  suppliers:
    '记录供应商的交付及时率、来料合格率与响应评分，用于绩效评分和风险分析。',
};

export function getDataTables(state: WorkspaceState): DataTableAsset[] {
  const tables: DataTableAsset[] = state.datasets.map((dataset) => ({
    id: dataset.id,
    name: dataset.name,
    comment:
      dataset.origin === 'sample' ? (tableComments[dataset.id] ?? '') : '',
    module: dataset.module,
    columns: dataset.columns,
    rows: dataset.rows.map((row) =>
      dataset.columns.map((column) => row[column]),
    ),
  }));
  const energy = state.datasets.find((dataset) => dataset.id === 'energy');
  if (energy?.origin === 'sample' && energy.energyDetails?.length) {
    tables.push({
      id: 'energy-details',
      name: '用电明细',
      comment:
        '按日期、产线、班次和工序记录用电量、产量及基准单耗，用于趋势、对比及异常分析。',
      module: 'energy',
      columns: [
        '日期',
        '产线',
        '班次',
        '工序',
        '用电量(kWh)',
        '产量(千只)',
        '基准单耗(kWh/千只)',
      ],
      rows: energy.energyDetails.map((row) => [
        row.date,
        row.line,
        row.shift,
        row.process,
        row.kwh,
        row.production,
        row.baseline,
      ]),
    });
  }
  return tables;
}

// Honor existing browser markers when reading historical source citations.
export function isDataResourceDeleted(
  state: Pick<WorkspaceState, 'deletedDataResourceIds'>,
  key: string,
): boolean {
  return state.deletedDataResourceIds?.includes(key) ?? false;
}
