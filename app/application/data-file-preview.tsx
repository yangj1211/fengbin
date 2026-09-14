'use client';
import { useId, useState } from 'react';
import SourcePreviewPanel from './source-preview-panel';
import { DataTable } from './ui';
import ListPagination, { getPageRange } from './list-pagination';
import { isDataResourceDeleted, type DataTableAsset } from './data-resources';
import { useWorkspace } from './store';

export default function DataFilePreview({
  name,
  resourceKey,
  table,
  onClose,
}: {
  name: string;
  resourceKey: string;
  table: DataTableAsset | undefined;
  onClose: () => void;
}) {
  const state = useWorkspace();
  const deleted = isDataResourceDeleted(state, resourceKey);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const controls = useId();
  const rows = !deleted ? (table?.rows.slice(0, 100) ?? []) : [];
  const range = getPageRange(rows.length, page, pageSize);
  return (
    <SourcePreviewPanel
      open
      title={name}
      description={
        deleted ? '文件已删除，无法查看原文。' : table?.comment || '查看文件内容。'
      }
      hideDescription={deleted}
      className="data-file-sheet"
      onClose={onClose}
    >
      {deleted ? (
        <p className="data-preview-empty">文件已删除，无法查看原文。</p>
      ) : table ? (
        <>
          <p className="data-file-summary">
            共 {table.rows.length} 条记录，最多预览前 100 条
          </p>
          <div id={controls} className="data-file-content">
            {rows.length ? (
              <DataTable
                columns={table.columns}
                rows={rows.slice(range.offset, range.offset + pageSize)}
              />
            ) : (
              <p className="data-preview-empty">文件中暂无数据。</p>
            )}
          </div>
          <ListPagination
            total={rows.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            controls={controls}
            label="文件内容分页"
          />
        </>
      ) : (
        <p className="data-preview-empty">
          当前资料已更新，无法预览此文件。请重新提问以获取当前可用的来源。
        </p>
      )}
    </SourcePreviewPanel>
  );
}
