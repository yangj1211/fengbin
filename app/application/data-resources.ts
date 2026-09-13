import { type ModuleId, type WorkspaceState } from './model';
import {
  sourceDocuments,
  documentsFor,
  type SourceDocument,
} from './knowledge-sources';
import { dataFiles, type DataFile } from './data-files';

export type DataTableAsset = {
  id: string;
  name: string;
  comment: string;
  module: ModuleId;
  columns: string[];
  rows: (string | number)[][];
};

type ResourceBase = { key: string; id: string; name: string; module: ModuleId };
export type DataResource = ResourceBase &
  (
    | { kind: '文件'; document: SourceDocument }
    | { kind: '文件'; file: DataFile; table: DataTableAsset }
    | { kind: '数据表'; table: DataTableAsset }
  );

const tableComments: Record<string, string> = {
  products:
    '记录电容器型号、额定电压、容量、温度、寿命及应用，用于需求匹配与产品推荐。',
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

export function getDataResources(state: WorkspaceState): DataResource[] {
  const tables = getDataTables(state);
  const customerDocumentIds = new Set(
    documentsFor('customer').map((document) => document.id),
  );
  const resources: DataResource[] = [
    ...sourceDocuments.map(
      (document): DataResource => ({
        key: `file:${document.id}`,
        id: document.id,
        name: document.fileName,
        kind: '文件',
        module: customerDocumentIds.has(document.id)
          ? 'customer'
          : 'maintenance',
        document,
      }),
    ),
    ...dataFiles.flatMap((file): DataResource[] => {
      const table = tables.find((item) => item.id === file.tableId);
      const dataset = state.datasets.find((item) => item.id === file.datasetId);
      return table && dataset?.origin === 'sample'
        ? [
            {
              key: `file:${file.tableId}`,
              id: file.tableId,
              name: file.name,
              module: table.module,
              kind: '文件',
              file,
              table,
            },
          ]
        : [];
    }),
    ...tables.map(
      (table): DataResource => ({
        key: `table:${table.id}`,
        id: table.id,
        name: table.name,
        kind: '数据表',
        module: table.module,
        table,
      }),
    ),
  ];
  const deleted = new Set(state.deletedDataResourceIds ?? []);
  return resources.filter((resource) => !deleted.has(resource.key));
}

export function isDataResourceDeleted(
  state: Pick<WorkspaceState, 'deletedDataResourceIds'>,
  key: string,
): boolean {
  return state.deletedDataResourceIds?.includes(key) ?? false;
}

// Keep historical citation identities; readers honor the persisted deletion marker.
export function removeDataResource(
  state: WorkspaceState,
  key: string,
): WorkspaceState {
  return {
    ...state,
    deletedDataResourceIds: [
      ...new Set([...(state.deletedDataResourceIds ?? []), key]),
    ],
  };
}
