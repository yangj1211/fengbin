'use client';
import { useMemo, useRef, useState } from 'react';
import { FilterIcon, XIcon } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { InputGroupAddon, InputGroupButton } from '@/components/ui/input-group';
import {
  nextScopeSelection,
  scopeButtonLabel,
  scopeLabel,
  scopeValues,
} from './scope';
const searchKey = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
export default function MultiScopeChoice({
  name,
  label,
  value,
  options,
  allLabel,
  onChange,
  variant = 'default',
  searchPlaceholder = `搜索${label}`,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  variant?: 'default' | 'column-header';
}) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(
    () => [...new Set([allLabel, ...options])],
    [allLabel, options],
  );
  const chosen = scopeValues(value, allLabel, items);
  const selected = chosen.length ? chosen : [allLabel];
  function clearSearch() {
    setQuery('');
    input.current?.focus();
  }
  return (
    <Combobox
      multiple
      items={items}
      value={selected}
      inputValue={query}
      onInputValueChange={(next, details) => {
        if (details.reason !== 'item-press') setQuery(next);
      }}
      onOpenChange={(open, details) => {
        if (!open && details.reason === 'item-press') {
          details.cancel();
          return;
        }
        if (!open) setQuery('');
      }}
      onValueChange={(next) => {
        onChange(nextScopeSelection(next, selected, allLabel, items));
        input.current?.focus();
      }}
      filter={(option, search) => searchKey(option).includes(searchKey(search))}
      autoHighlight
    >
      <ComboboxTrigger
        id={name}
        data-slot={
          variant === 'column-header'
            ? 'column-filter-trigger'
            : 'select-trigger'
        }
        data-active={
          variant === 'column-header' && chosen.length ? '' : undefined
        }
        aria-label={variant === 'column-header' ? '筛选' + label : label}
        aria-description={
          variant === 'column-header' ? scopeLabel(value, allLabel) : undefined
        }
        title={scopeLabel(value, allLabel)}
        className={
          variant === 'column-header'
            ? 'scope-column-filter'
            : 'flex min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0'
        }
      >
        {variant === 'column-header' ? (
          <>
            <span>{label}</span>
            <FilterIcon className="size-3.5" aria-hidden="true" />
            {chosen.length > 0 && (
              <span className="scope-column-filter-count" aria-hidden="true">
                {chosen.length}
              </span>
            )}
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">
            {scopeButtonLabel(value, allLabel, items)}
          </span>
        )}
      </ComboboxTrigger>
      <ComboboxContent
        data-slot="select-content"
        className="flex min-w-[min(18rem,var(--available-width))] flex-col motion-reduce:animate-none motion-reduce:duration-0"
        aria-label={`选择${label}`}
        initialFocus={input}
      >
        <ComboboxInput
          ref={input}
          aria-label={`搜索${label}`}
          placeholder={searchPlaceholder}
          showTrigger={false}
          autoComplete="off"
          className="shrink-0 [&_[data-slot=input-group-addon]:empty]:hidden"
        >
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="清空搜索"
                title="清空搜索"
                size="icon-xs"
                onClick={clearSearch}
              >
                <XIcon aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </ComboboxInput>
        <div className="flex shrink-0 items-center justify-between gap-2 px-2 py-1">
          <output className="text-sm" aria-live="polite">
            {scopeButtonLabel(value, allLabel, items)}
          </output>
          <button
            type="button"
            className="scope-selection-clear"
            aria-label="清空所选范围，显示全部"
            onClick={() => {
              onChange(allLabel);
              clearSearch();
            }}
          >
            清空
          </button>
        </div>
        <ComboboxEmpty className="block p-0 text-left text-foreground [&:not(:empty)]:px-3 [&:not(:empty)]:py-4">
          没有匹配项，请换个关键词或清空搜索。
        </ComboboxEmpty>
        <ComboboxList aria-label={`${label}选项`} className="min-h-0">
          {(option: string) => (
            <ComboboxItem
              key={option}
              value={option}
              title={option}
              className="min-h-9 items-start py-1.5 pl-2.5 leading-5 data-selected:font-medium"
            >
              <span className="min-w-0 whitespace-normal wrap-anywhere">
                {option}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
