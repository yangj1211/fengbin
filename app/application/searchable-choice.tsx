'use client';

import { useMemo, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
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

type SearchableChoiceProps = {
  name: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
};

function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

/** Search changes the available options; only selecting an option changes scope. */
export default function SearchableChoice({
  name,
  label,
  value,
  options,
  onChange,
  searchPlaceholder = `搜索${label}`,
}: SearchableChoiceProps) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => Array.from(new Set(options)), [options]);
  function clearSearch() {
    setQuery('');
    input.current?.focus();
  }
  return (
    <Combobox
      items={items}
      value={value}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (!open) setQuery('');
      }}
      onValueChange={(next) => {
        if (next !== null && items.includes(next)) onChange(next);
      }}
      filter={(option, search) =>
        normalizeSearch(option).includes(normalizeSearch(search))
      }
      autoHighlight
    >
      <ComboboxTrigger
        id={name}
        data-slot="select-trigger"
        aria-label={label}
        title={value}
        className="flex min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0"
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {value || `选择${label}`}
        </span>
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
        <ComboboxEmpty className="block p-0 text-left text-foreground [&:not(:empty)]:px-3 [&:not(:empty)]:py-4">
          {items.length
            ? '没有匹配项，请换个关键词或清空搜索。'
            : '暂无可选项。'}
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
