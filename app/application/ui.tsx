'use client';
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ArrowRight, FileText } from 'lucide-react';
export function AppHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="application-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  suffix,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  suffix?: string;
}) {
  return (
    <div className="app-field">
      <Label htmlFor={name}>{label}</Label>
      <div className="input-affix">
        <Input
          id={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          step={type === 'number' ? 'any' : undefined}
          maxLength={160}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  );
}
export function Choice({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="app-field">
      <Label htmlFor={name}>{label}</Label>
      <Select
        value={value}
        items={options.map((v) => ({ label: v, value: v }))}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
      >
        <SelectTrigger id={name}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function DataTable({
  columns,
  rows,
  actions,
}: {
  columns: string[];
  rows: (string | number)[][];
  actions?: (index: number) => ReactNode;
}) {
  return (
    <Table className="app-table">
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c}>{c}</TableHead>
          ))}
          {actions && <TableHead>操作</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((v, j) => (
              <TableCell key={j}>
                {['需关注', '较高风险', '需观察', '待跟进'].includes(
                  String(v),
                ) ? (
                  <span className="app-status warning">{v}</span>
                ) : (
                  v
                )}
              </TableCell>
            ))}
            {actions && <TableCell>{actions(i)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function EmptyState({
  title,
  description,
  onAction,
  action = '开始分析',
}: {
  title: string;
  description: string;
  onAction?: () => void;
  action?: string;
}) {
  return (
    <div className="app-empty">
      <FileText size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
      {onAction && (
        <Button onClick={onAction}>
          {action}
          <ArrowRight size={15} />
        </Button>
      )}
    </div>
  );
}
export function download(
  name: string,
  content: string,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}
