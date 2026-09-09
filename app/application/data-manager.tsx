'use client';
import { useState } from 'react';
import {
  Database,
  Upload,
  Download,
  Plus,
  PenLine,
  Trash2,
  RotateCcw,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  initialDatasets,
  modules,
  validateDataset,
  importCSV,
  csvExport,
  type WorkspaceState,
  type Dataset,
  type Row,
} from './model';
import { storageMessage, updateWorkspace } from './store';
import { AppHeading, DataTable, download } from './ui';
export default function DataManager({
  state,
  navigate,
}: {
  state: WorkspaceState;
  navigate: (path: string) => void;
}) {
  const [selected, setSelected] = useState('products');
  const dataset = state.datasets.find((d) => d.id === selected)!;
  const reference = initialDatasets.find((d) => d.id === selected)!;
  const [message, setMessage] = useState('');
  const [edit, setEdit] = useState<{ index: number; row: Row } | null>(null);
  const [editError, setEditError] = useState('');
  const [remove, setRemove] = useState<number | null>(null);
  const [restore, setRestore] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState<Dataset | null>(null);
  const [importError, setImportError] = useState('');
  function persist(next: Dataset) {
    const error = validateDataset(next);
    if (error) {
      setEditError(error);
      return false;
    }
    if (
      !updateWorkspace((s) => ({
        ...s,
        datasets: s.datasets.map((d) => (d.id === next.id ? next : d)),
      }))
    ) {
      setEditError(storageMessage());
      setMessage(storageMessage());
      return false;
    }
    return true;
  }
  function commitEdit() {
    if (!edit) return;
    const rows = [...dataset.rows];
    const row = Object.fromEntries(
      reference.columns.map((c) => [c, String(edit.row[c] ?? '').trim()]),
    );
    if (edit.index < 0) rows.push(row);
    else rows[edit.index] = row;
    const next = {
      ...dataset,
      rows,
      origin: 'local' as const,
      fileName: '本地编辑',
      updatedAt: new Date().toISOString(),
    };
    if (persist(next)) {
      setEdit(null);
      setMessage('数据已保存，后续分析将使用更新后的数据。');
    }
  }
  function deleteRow() {
    if (remove === null) return;
    const next = {
      ...dataset,
      rows: dataset.rows.filter((_, i) => i !== remove),
      origin: 'local' as const,
      fileName: '本地编辑',
      updatedAt: new Date().toISOString(),
    };
    if (persist(next)) {
      setRemove(null);
      setMessage('数据行已删除。');
    } else setRemove(null);
  }
  async function readFile(file: File | undefined) {
    setImported(null);
    setImportError('');
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setImportError('请选择 CSV 文件。');
      return;
    }
    if (file.size > 512000) {
      setImportError('文件最大为 500 KB，请保留不超过 500 行。');
      return;
    }
    try {
      setImported(importCSV(reference, await file.text(), file.name));
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : '无法读取文件，请检查内容。',
      );
    }
  }
  function commitImport() {
    if (!imported) return;
    if (persist(imported)) {
      setImportOpen(false);
      setMessage(
        `已导入 ${imported.rows.length} 条数据，后续分析将使用该数据集。`,
      );
      setImported(null);
    }
  }
  function template() {
    download(
      reference.name + '-模板.csv',
      csvExport(
        reference.columns,
        reference.rows.map((r) => reference.columns.map((c) => r[c])),
      ),
      'text/csv;charset=utf-8',
    );
  }
  return (
    <>
      <AppHeading
        title="数据管理"
        description="维护五个业务模块的数据，查看、编辑或导入本地资料。"
        action={
          <Button
            variant="outline"
            onClick={() => navigate('/apps/' + dataset.module)}
          >
            进入业务模块
            <ArrowRight size={15} />
          </Button>
        }
      />
      <div className="data-workspace-note">
        <Database size={19} />
        <div>
          <strong>当前浏览器工作区</strong>
          <p>
            编辑与导入的数据只保存在当前浏览器。已保存的分析保留当时的结果快照。
          </p>
        </div>
        <span className="app-status">AI 与业务系统待接入</span>
      </div>
      {message && <output className="app-message">{message}</output>}
      <section className="app-section data-manager-section">
        <Tabs
          value={selected}
          onValueChange={(v) => {
            setSelected(String(v));
            setMessage('');
          }}
        >
          <TabsList variant="line" className="dataset-tabs">
            {initialDatasets.map((d) => (
              <TabsTrigger key={d.id} value={d.id}>
                {modules.find((m) => m.id === d.module)?.category}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={selected}>
            <div className="dataset-heading">
              <div>
                <h2>{dataset.name}</h2>
                <p>
                  {dataset.rows.length} 条数据 ·{' '}
                  {dataset.origin === 'sample'
                    ? '示例数据'
                    : (dataset.fileName ?? '本地数据')}
                  {dataset.updatedAt
                    ? ' · ' +
                      new Date(dataset.updatedAt).toLocaleDateString('zh-CN')
                    : ''}
                </p>
              </div>
              <div className="dataset-actions">
                <Button variant="ghost" onClick={template}>
                  <Download size={15} />
                  下载模板
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportOpen(true);
                    setImported(null);
                    setImportError('');
                  }}
                >
                  <Upload size={15} />
                  导入 CSV
                </Button>
                <Button
                  onClick={() => {
                    setEdit({
                      index: -1,
                      row: Object.fromEntries(
                        dataset.columns.map((c) => [c, '']),
                      ),
                    });
                    setEditError('');
                  }}
                >
                  <Plus size={15} />
                  新增数据
                </Button>
              </div>
            </div>
            <DataTable
              columns={dataset.columns}
              rows={dataset.rows.map((r) => dataset.columns.map((c) => r[c]))}
              actions={(i) => (
                <div className="row-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={'编辑第 ' + (i + 1) + ' 行'}
                    onClick={() => {
                      setEdit({ index: i, row: { ...dataset.rows[i] } });
                      setEditError('');
                    }}
                  >
                    <PenLine size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={dataset.rows.length <= 1}
                    title={
                      dataset.rows.length <= 1 ? '至少保留一条数据' : '删除数据'
                    }
                    aria-label={'删除第 ' + (i + 1) + ' 行'}
                    onClick={() => setRemove(i)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            />
            <div className="dataset-footer">
              <Button
                variant="ghost"
                onClick={() =>
                  download(
                    dataset.name + '.csv',
                    csvExport(
                      dataset.columns,
                      dataset.rows.map((r) => dataset.columns.map((c) => r[c])),
                    ),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                <Download size={14} />
                导出数据
              </Button>
              <Button
                variant="ghost"
                onClick={() => setRestore(true)}
                disabled={dataset.origin === 'sample'}
              >
                <RotateCcw size={14} />
                恢复示例数据
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </section>
      <Dialog
        open={Boolean(edit)}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
      >
        <DialogContent className="app-dialog data-edit-dialog">
          <DialogHeader>
            <DialogTitle>
              {edit?.index === -1 ? '新增数据' : '编辑数据'}
            </DialogTitle>
            <DialogDescription>
              {dataset.name} · 所有字段均为必填，保存后影响后续分析。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitEdit();
            }}
          >
            <div className="edit-fields">
              {dataset.columns.map((c) => (
                <div className="app-field" key={c}>
                  <Label htmlFor={'edit-' + c}>{c}</Label>
                  <Input
                    id={'edit-' + c}
                    type={
                      typeof reference.rows[0][c] === 'number'
                        ? 'number'
                        : 'text'
                    }
                    step="any"
                    required
                    maxLength={500}
                    value={String(edit?.row[c] ?? '')}
                    onChange={(e) => {
                      if (edit)
                        setEdit({
                          ...edit,
                          row: { ...edit.row, [c]: e.target.value },
                        });
                    }}
                  />
                </div>
              ))}
            </div>
            {editError && (
              <p className="form-error" role="alert">
                {editError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEdit(null)}
              >
                取消
              </Button>
              <Button type="submit">保存数据</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这一行数据？</AlertDialogTitle>
            <AlertDialogDescription>
              该条目将不再参与后续分析。已保存的分析记录不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={deleteRow}>
              删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={restore} onOpenChange={setRestore}>
        <AlertDialogContent className="app-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>恢复此数据集的示例内容？</AlertDialogTitle>
            <AlertDialogDescription>
              将替换当前的「{dataset.name}」。需要保留修改时，请先导出 CSV。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRestore(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (persist({ ...reference })) {
                  setRestore(false);
                  setMessage('已恢复示例数据。');
                }
              }}
            >
              恢复示例数据
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="app-dialog import-dialog">
          <DialogHeader>
            <DialogTitle>导入 {dataset.name}</DialogTitle>
            <DialogDescription>
              先下载模板并填写，再上传
              CSV。导入会替换此数据集；文件仅在本机读取。
            </DialogDescription>
          </DialogHeader>
          <div className="import-file-control">
            <FileSpreadsheet size={24} />
            <div>
              <Label htmlFor="csv-file">选择 CSV 文件</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
              <p>UTF-8 编码 · 最多 500 行 · 最大 500 KB</p>
            </div>
            <Button variant="outline" onClick={template}>
              下载模板
            </Button>
          </div>
          {importError && (
            <p className="form-error" role="alert">
              {importError}
            </p>
          )}
          {imported && (
            <div className="import-preview">
              <p>校验通过，共 {imported.rows.length} 条。下方预览前 5 条：</p>
              <DataTable
                columns={imported.columns}
                rows={imported.rows
                  .slice(0, 5)
                  .map((r) => imported.columns.map((c) => r[c]))}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button onClick={commitImport} disabled={!imported}>
              确认导入{imported ? ' ' + imported.rows.length + ' 条' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
