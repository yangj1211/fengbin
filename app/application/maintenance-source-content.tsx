'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The scrollable source record must be focusable for keyboard scrolling. */
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maintenanceTables, maintenanceImages } from './maintenance-data';
import type { SourceReference } from './customer-types';
import BackButton from './back-button';

export default function MaintenanceSourceContent({
  selected,
  library,
  onSelect,
}: {
  selected: SourceReference;
  library?: boolean;
  onSelect: (reference: SourceReference | null) => void;
}) {
  const table = maintenanceTables.find((item) => item.id === selected.documentId);
  if (!table) return null;
  const index = table.rows.findIndex((row) => String(row[0]) === selected.sectionId);
  const row = table.rows[index];
  if (!row) return <p className="source-unavailable">当前资料中未查到这条记录。</p>;
  const selectRecord = (next: number) => {
    const record = table.rows[next];
    if (record) onSelect({ documentId: table.id, sectionId: String(record[0]), page: 1 });
  };
  return (
    <>
      <div className="source-page-toolbar maintenance-record-toolbar">
        {library && <BackButton destination="资料列表" onClick={() => onSelect(null)} />}
        <nav className="source-page-controls" aria-label="原表记录导航">
          <Button variant="ghost" size="icon-sm" aria-label="上一条记录" disabled={index === 0} onClick={() => selectRecord(index - 1)}><ChevronLeft size={17} /></Button>
          <Select
            value={index}
            items={table.rows.map((record, i) => ({ value: i, label: String(record[0]) }))}
            onValueChange={(next) => { if (next !== null) selectRecord(next); }}
          >
            <SelectTrigger aria-label="选择原表记录"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {table.rows.map((record, i) => <SelectItem key={String(record[0])} value={i}>{String(record[0])}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" aria-label="下一条记录" disabled={index === table.rows.length - 1} onClick={() => selectRecord(index + 1)}><ChevronRight size={17} /></Button>
        </nav>
      </div>
      <p className="maintenance-record-location">工作表：{table.sheetName}<br />原表第 {index + 2} 行 · 第 {index + 1} / {table.rows.length} 条记录</p>
      <div className="maintenance-record-content" tabIndex={0} aria-label={`${table.fileName}，原表第${index + 2}行`}>
        <dl className="maintenance-record-fields">
          {table.columns.map((column, i) => {
            const photo = column === '图片文件名' ? maintenanceImages.find((image) => image.fileName === row[i]) : undefined;
            return (
              <div key={column}>
                <dt>{column}</dt>
                <dd>{photo ? <button className="maintenance-image-reference" onClick={() => onSelect({ documentId: `maintenance-image-${photo.faultId}`, sectionId: photo.faultId, page: 1 })}><ImageIcon size={16} />{photo.fileName}</button> : row[i] === null || row[i] === '' ? <span className="maintenance-empty-value">空白</span> : String(row[i])}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </>
  );
}
