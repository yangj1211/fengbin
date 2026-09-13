'use client';
import { Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { download } from './ui';

export default function DetailExport({
  name,
  columns,
  rows,
}: {
  name: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  async function exportDetails() {
    if (running.current || !columns.length || !rows.length) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const { createDetailWorkbook } = await import('./xlsx-export');
      const bytes = await createDetailWorkbook(columns, rows);
      const filename = (name.trim() || '明细')
        .replace(/\.(csv|xlsx?)$/i, '')
        .replace(/[\\/:*?"<>|]/g, '_');
      download(
        filename + '.xlsx',
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.startsWith('明细超过 Excel')
          ? cause.message
          : '导出失败，请重试。',
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !columns.length || !rows.length}
        aria-busy={busy}
        title="导出当前筛选下的全部明细（.xlsx）"
        onClick={exportDetails}
      >
        <Download size={15} />
        {busy ? '正在导出…' : '导出明细'}
      </Button>
      {error && (
        <p role="alert" className="max-w-64 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
