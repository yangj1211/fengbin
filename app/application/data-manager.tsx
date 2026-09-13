'use client';
import { useId, useState } from 'react';
import { Eye, FileText, Search, Table2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { modules, type WorkspaceState } from './model';
import {
  getDataResources,
  removeDataResource,
  type DataResource,
} from './data-resources';
import { updateWorkspace, storageMessage } from './store';
import type { SourceReference } from './customer-types';
import { SourceDrawer } from './customer-sources';
import { AppHeading, DataTable } from './ui';
import MultiScopeChoice from './multi-scope-choice';
import { filterScope } from './scope';
import DetailExport from './detail-export';
import DataFilePreview from './data-file-preview';
import ListPagination, { getPageRange } from './list-pagination';

export default function DataManager({ state }: { state: WorkspaceState }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('全部类型');
  const [agent, setAgent] = useState('全部智能体');
  const [tableKey, setTableKey] = useState<string | null>(null);
  const [source, setSource] = useState<SourceReference | null>(null);
  const [csvKey, setCsvKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [pendingDelete, setPendingDelete] = useState<DataResource | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [message, setMessage] = useState('');
  const resourceTableId = useId();
  const detailTableId = useId();
  const resources = getDataResources(state);
  const visible = filterScope(
    filterScope(resources, type, '全部类型', (resource) => resource.kind),
    agent,
    '全部智能体',
    (resource) =>
      modules.find((module) => module.id === resource.module)?.name ?? '',
  ).filter((resource) =>
    resource.name
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const selectedResource = resources.find(
    (resource) => resource.key === tableKey,
  );
  const selectedTable =
    selectedResource?.kind === '数据表' ? selectedResource.table : null;
  const selectedCsv = resources.find((resource) => resource.key === csvKey);
  const sampleRows = selectedTable?.rows.slice(0, 100) ?? [];
  const resourceRange = getPageRange(visible.length, page, pageSize);
  const detailRange = getPageRange(sampleRows.length, tablePage, tablePageSize);

  function preview(resource: DataResource) {
    if (resource.kind === '数据表') {
      setTablePage(1);
      setTableKey(resource.key);
    } else if ('file' in resource) {
      setCsvKey(resource.key);
    } else {
      const first = resource.document.sections[0];
      if (first)
        setSource({
          documentId: resource.id,
          sectionId: first.id,
          page: first.page,
        });
    }
  }
  function confirmDelete() {
    if (!pendingDelete) return;
    const ok = updateWorkspace((current) =>
      removeDataResource(current, pendingDelete.key),
    );
    if (!ok) {
      setDeleteError(storageMessage() || '删除失败，请重试。');
      return;
    }
    setPage(
      Math.min(
        resourceRange.currentPage,
        Math.max(1, Math.ceil((visible.length - 1) / pageSize)),
      ),
    );
    setMessage(`已从数据管理列表删除“${pendingDelete.name}”。`);
    setPendingDelete(null);
    setDeleteError('');
  }

  if (selectedTable)
    return (
      <>
        <AppHeading
          title="数据表预览"
          description="查看表信息与数据记录。"
          back={{ destination: '数据管理', onClick: () => setTableKey(null) }}
        />
        <section
          className="app-section data-table-detail"
          aria-label={selectedTable.name}
        >
          <dl className="data-table-metadata">
            <div>
              <dt>表名</dt>
              <dd>{selectedTable.name}</dd>
            </div>
            <div>
              <dt>表注释</dt>
              <dd>{selectedTable.comment || '暂无表注释'}</dd>
            </div>
          </dl>
          <div className="data-resource-toolbar">
            <div className="data-preview-heading">
              <span>数据记录</span>
              <p>共 {selectedTable.rows.length} 条，最多预览前 100 条</p>
            </div>
            <DetailExport
              name={selectedTable.name + '-明细'}
              columns={selectedTable.columns}
              rows={selectedTable.rows}
            />
          </div>
          <div id={detailTableId}>
            {sampleRows.length ? (
              <DataTable
                columns={selectedTable.columns}
                rows={sampleRows.slice(
                  detailRange.offset,
                  detailRange.offset + tablePageSize,
                )}
              />
            ) : (
              <p className="data-preview-empty">暂无数据记录。</p>
            )}
          </div>
          <ListPagination
            total={sampleRows.length}
            page={tablePage}
            pageSize={tablePageSize}
            onPageChange={setTablePage}
            onPageSizeChange={setTablePageSize}
            controls={detailTableId}
            label="数据记录分页"
          />
        </section>
      </>
    );

  return (
    <>
      <AppHeading
        title="数据管理"
        description="统一管理五个智能体使用的业务文件与数据表。"
      />
      {selectedCsv && 'file' in selectedCsv && (
        <DataFilePreview
          key={selectedCsv.key}
          resourceKey={selectedCsv.key}
          name={selectedCsv.name}
          table={selectedCsv.table}
          onClose={() => setCsvKey(null)}
        />
      )}
      {message && (
        <output className="data-resource-message">
          {message}
        </output>
      )}
      <section
        className="app-section data-resource-list"
        aria-label="文件与数据表"
      >
        <div className="data-resource-toolbar">
          <div className="search-field">
            <Search size={17} />
            <Input
              aria-label="搜索文件或数据表"
              placeholder="搜索文件或数据表"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
                setMessage('');
              }}
            />
          </div>
        </div>
        <Table id={resourceTableId} className="app-table data-resource-table">
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>
                <MultiScopeChoice
                  variant="column-header"
                  label="类型"
                  name="data-resource-type"
                  value={type}
                  allLabel="全部类型"
                  options={['文件', '数据表']}
                  onChange={(value) => {
                    setType(value);
                    setPage(1);
                    setMessage('');
                  }}
                />
              </TableHead>
              <TableHead>
                <MultiScopeChoice
                  variant="column-header"
                  label="关联智能体"
                  name="data-resource-agent"
                  value={agent}
                  allLabel="全部智能体"
                  options={modules.map((module) => module.name)}
                  onChange={(value) => {
                    setAgent(value);
                    setPage(1);
                    setMessage('');
                  }}
                />
              </TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible
              .slice(resourceRange.offset, resourceRange.offset + pageSize)
              .map((resource) => (
                <TableRow key={resource.key}>
                  <TableCell>
                    <span className="data-resource-name">
                      {resource.kind === '文件' ? (
                        <FileText size={19} />
                      ) : (
                        <Table2 size={19} />
                      )}
                      <span>{resource.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>{resource.kind}</TableCell>
                  <TableCell>
                    {
                      modules.find((module) => module.id === resource.module)
                        ?.name
                    }
                  </TableCell>
                  <TableCell>
                    <div className="data-resource-actions">
                      <Tooltip>
                        <TooltipTrigger
                          delay={200}
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="data-resource-icon-button"
                            />
                          }
                          aria-label={`预览${resource.name}`}
                          onClick={() => preview(resource)}
                        >
                          <Eye size={17} aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>预览</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          delay={200}
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="data-resource-icon-button data-resource-delete"
                            />
                          }
                          aria-label={`删除${resource.name}`}
                          onClick={() => {
                            setPendingDelete(resource);
                            setDeleteError('');
                            setMessage('');
                          }}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!visible.length && (
              <TableRow>
                <TableCell colSpan={4} className="data-resource-empty">
                  没有找到匹配的文件或数据表。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ListPagination
          total={visible.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          controls={resourceTableId}
          label="文件与数据表分页"
        />
      </section>
      <SourceDrawer
        selected={source}
        onSelect={setSource}
        onClose={() => setSource(null)}
      />
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError('');
          }
        }}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>删除{pendingDelete?.kind}？</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.name}
              ”将被删除，无法再预览。
              {pendingDelete?.kind === '文件'
                ? '历史回答和引用名称仍保留，但无法查看原文件。'
                : '历史回答内容仍保留。'}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="form-error">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
