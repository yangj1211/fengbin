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
import BackButton from './back-button';
import SearchableChoice from './searchable-choice';
import MultiScopeChoice from './multi-scope-choice';
export function AppHeading({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  back?: { destination: string; onClick: () => void };
}) {
  return (
    <div className="application-heading">
      <div className="application-heading-main">
        {back && (
          <BackButton
            destination={back.destination}
            onClick={back.onClick}
            iconOnly
          />
        )}
        <div className="application-heading-copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
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
  searchable = false,
  searchPlaceholder,
  multiple = false,
  allLabel,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  multiple?: boolean;
  allLabel?: string;
}) {
  return (
    <div className="app-field">
      <Label htmlFor={name}>{label}</Label>
      {multiple ? (
        <MultiScopeChoice
          name={name}
          label={label}
          value={value}
          options={options}
          onChange={onChange}
          allLabel={allLabel ?? options[0] ?? '全部'}
          searchPlaceholder={searchPlaceholder}
        />
      ) : searchable ? (
        <SearchableChoice
          name={name}
          label={label}
          value={value}
          options={options}
          onChange={onChange}
          searchPlaceholder={searchPlaceholder}
        />
      ) : (
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
      )}
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
  content: string | Blob,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
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
