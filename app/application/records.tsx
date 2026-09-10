'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Search,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  modules,
  csvExport,
  type WorkspaceState,
  type AnalysisRecord,
} from './model';
import { updateWorkspace, storageMessage } from './store';
import AnalysisResult from './result';
import {
  AppHeading,
  Choice,
  DataTable,
  EmptyState,
  download,
  formatDate,
} from './ui';
import { startConversation } from './sessions';
import { resolveSource } from './customer-data';
export default function Records({
  state,
  recordId,
  navigate,
}: {
  state: WorkspaceState;
  recordId?: string;
  navigate: (path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('全部模块');
  const [status, setStatus] = useState('全部状态');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AnalysisRecord | null>(null);
  const [editedNote, setEditedNote] = useState<string | null>(null);
  const [editedStatus, setEditedStatus] = useState<string | null>(null);
  const record = state.records.find((r) => r.id === recordId);
  const filtered = state.records.filter(
    (r) =>
      (filter === '全部模块' ||
        modules.find((m) => m.id === r.module)?.name === filter) &&
      (status === '全部状态' || r.state === status) &&
      r.name.toLowerCase().includes(query.toLowerCase()),
  );
  function remove() {
    if (!deleteTarget) return;
    if (
      updateWorkspace((s) => ({
        ...s,
        records: s.records.filter((r) => r.id !== deleteTarget.id),
      }))
    ) {
      setDeleteTarget(null);
      if (recordId) navigate('/records');
      else setMessage('记录已删除。');
    } else setMessage(storageMessage());
  }
  function saveUpdate() {
    if (!record) return;
    const current = record;
    const note = editedNote ?? current.note;
    const newState = (editedStatus ?? current.state) as '待跟进' | '已完成';
    if (
      updateWorkspace((s) => ({
        ...s,
        records: s.records.map((r) =>
          r.id === current.id ? { ...r, note, state: newState } : r,
        ),
      }))
    )
      setMessage('跟进信息已保存。');
    else setMessage(storageMessage());
  }
  function reuse() {
    if (!record) return;
    const current = record;
    if (
      updateWorkspace((s) =>
        startConversation(s, current.module, current.inputs),
      )
    )
      navigate('/apps/' + current.module);
    else setMessage(storageMessage());
  }
  function exportRecord(r: AnalysisRecord) {
    const sourceNotes = (r.analysis.sources ?? [])
      .map((ref) => {
        const source = resolveSource(ref);
        return source
          ? `${source.document.fileName}，第 ${ref.page} 页，${source.section.title}\n${source.section.text}`
          : '';
      })
      .filter(Boolean)
      .join('\n\n');
    const text = `# ${r.name}\n\n记录编号：${r.id}\n创建时间：${new Date(r.createdAt).toLocaleString('zh-CN')}\n来源：${r.sourceName}（${r.sourceOrigin === 'sample' ? '示例数据' : '本地导入'}）\n状态：${r.state}\n\n## 分析结论\n${r.analysis.title}\n\n${r.analysis.summary}\n\n## 输入参数\n${Object.entries(
      r.inputs,
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join(
        '\n',
      )}\n\n## 详细结果\n${r.analysis.columns.join(' | ')}\n${r.analysis.rows.map((row) => row.join(' | ')).join('\n')}\n\n## 建议\n${r.analysis.recommendation}\n\n## 依据\n${r.analysis.basis.join('\n')}${sourceNotes ? '\n\n## 引用原文件\n' + sourceNotes : ''}${r.customerDecision ? '\n\n采用记录：' + r.customerDecision.model + (r.customerDecision.action === 'adopt' ? ' 已采用' : ' 已撤回') : ''}\n\n## 跟进说明\n${r.note || '尚未填写'}\n`;
    download(
      r.name.replace(/[\\/:*?"<>|]/g, '_') + '.md',
      text,
      'text/markdown;charset=utf-8',
    );
  }
  const deletion = (
    <AlertDialog
      open={Boolean(deleteTarget)}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
    >
      <AlertDialogContent className="app-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>删除这份分析记录？</AlertDialogTitle>
          <AlertDialogDescription>
            「{deleteTarget?.name}
            」将从当前浏览器移除。需要留档时，请先导出记录。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>
          <Button variant="destructive" onClick={remove}>
            删除记录
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  if (recordId && !record)
    return (
      <>
        <AppHeading
          title="分析记录"
          description="查看已保存的分析与处理过程。"
        />
        <section className="app-section">
          <EmptyState
            title="未找到这份记录"
            description="记录保存在创建它的浏览器中，可能已被删除或尚未在此浏览器保存。"
            onAction={() => navigate('/records')}
            action="返回记录列表"
          />
        </section>
      </>
    );
  if (record) {
    const note = editedNote ?? record.note;
    const currentState = editedStatus ?? record.state;
    return (
      <>
        <div className="back-link">
          <Button variant="ghost" onClick={() => navigate('/records')}>
            <ArrowLeft size={15} />
            分析记录
          </Button>
        </div>
        <AppHeading
          title={record.name}
          description={`${modules.find((m) => m.id === record.module)?.name} · ${formatDate(record.createdAt)} · ${record.sourceOrigin === 'sample' ? '示例数据' : '本地数据'}`}
          action={
            <div className="heading-actions">
              <Button variant="outline" onClick={() => exportRecord(record)}>
                <Download size={15} />
                导出
              </Button>
              <Button onClick={reuse}>
                以此创建新分析
                <ArrowRight size={15} />
              </Button>
            </div>
          }
        />
        {message && <output className="app-message">{message}</output>}
        <div className="record-detail-grid">
          <section className="app-section">
            <AnalysisResult
              analysis={record.analysis}
              module={record.module}
              decision={record.customerDecision}
            />
          </section>
          <aside className="record-followup">
            <h2>处理与跟进</h2>
            <Choice
              name="followup-state"
              label="记录状态"
              value={currentState}
              options={['待跟进', '已完成']}
              onChange={setEditedStatus}
            />
            <div className="app-field">
              <Label htmlFor="followup-note">处理说明</Label>
              <Textarea
                id="followup-note"
                value={note}
                onChange={(e) => setEditedNote(e.target.value)}
                placeholder="填写检查结论、处理措施或后续安排…"
                maxLength={4000}
              />
            </div>
            <Button onClick={saveUpdate}>
              <Save size={15} />
              保存跟进信息
            </Button>
            <div className="record-reference">
              <h3>记录信息</h3>
              <p>编号</p>
              <code>{record.id.slice(0, 8).toUpperCase()}</code>
              <p>数据来源</p>
              <strong>{record.sourceName}</strong>
              <p>记录位置</p>
              <strong>当前浏览器</strong>
            </div>
            <Button
              variant="ghost"
              className="delete-record-button"
              onClick={() => setDeleteTarget(record)}
            >
              <Trash2 size={14} />
              删除记录
            </Button>
          </aside>
        </div>
        {deletion}
      </>
    );
  }
  return (
    <>
      <AppHeading
        title="分析记录"
        description="集中查看分析方案，跟进处理结果。"
        action={
          <Button
            variant="outline"
            disabled={!filtered.length}
            onClick={() =>
              download(
                '分析记录.csv',
                csvExport(
                  ['记录名称', '业务模块', '创建时间', '状态', '来源'],
                  filtered.map((r) => [
                    r.name,
                    modules.find((m) => m.id === r.module)!.name,
                    formatDate(r.createdAt),
                    r.state,
                    r.sourceName,
                  ]),
                ),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={15} />
            导出列表
          </Button>
        }
      />
      {message && <output className="app-message">{message}</output>}
      <section className="app-section">
        <div className="records-toolbar">
          <div className="search-field">
            <Search size={17} />
            <Input
              aria-label="搜索记录名称"
              placeholder="搜索记录名称"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Choice
            name="record-module"
            label="业务模块"
            value={filter}
            options={['全部模块', ...modules.map((m) => m.name)]}
            onChange={setFilter}
          />
          <Choice
            name="record-status"
            label="记录状态"
            value={status}
            options={['全部状态', '待跟进', '已完成']}
            onChange={setStatus}
          />
        </div>
        {filtered.length ? (
          <DataTable
            columns={['记录名称', '业务模块', '创建时间', '状态', '数据来源']}
            rows={filtered.map((r) => [
              r.name,
              modules.find((m) => m.id === r.module)?.name ?? '',
              formatDate(r.createdAt),
              r.state,
              r.sourceOrigin === 'sample' ? '示例数据' : '本地导入',
            ])}
            actions={(i) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/records/' + filtered[i].id)}
                >
                  查看
                  <ArrowRight size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={'删除 ' + filtered[i].name}
                  onClick={() => setDeleteTarget(filtered[i])}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          />
        ) : (
          <EmptyState
            title={
              state.records.length ? '没有符合条件的记录' : '还没有保存的分析'
            }
            description={
              state.records.length
                ? '调整搜索关键词或筛选条件后再试。'
                : '从任意业务模块创建分析，保存后即可在这里继续处理。'
            }
            onAction={
              state.records.length
                ? () => {
                    setQuery('');
                    setFilter('全部模块');
                    setStatus('全部状态');
                  }
                : () => navigate('/apps/customer')
            }
            action={state.records.length ? '清除筛选' : '创建第一份分析'}
          />
        )}
        <div className="table-bottom-note">
          共 {filtered.length} 份记录 · 当前浏览器工作区
        </div>
      </section>
      {deletion}
    </>
  );
}
