/** Multi-scope values stay strings so older conversations and saved records remain valid. */
const prefix = '@scope:';
const unique = (values: readonly string[]) => [
  ...new Set(values.filter(Boolean)),
];
export function normalizeScopeName(value: string): string {
  const digits: Record<string, string> = {
    一: '1',
    二: '2',
    两: '2',
    三: '3',
    四: '4',
    五: '5',
    六: '6',
    七: '7',
    八: '8',
    九: '9',
    十: '10',
  };
  return value
    .normalize('NFKC')
    .replace(/\s/g, '')
    .toLowerCase()
    .replace(
      /第?(\d+|[一二两三四五六七八九十]+)(?:号|条)?产线/g,
      (_, number: string) => {
        const tens = number.match(
          /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/,
        );
        const normalized = /^\d+$/.test(number)
          ? String(Number(number))
          : (digits[number] ??
            (tens
              ? String(
                  Number(digits[tens[1]] ?? 1) * 10 +
                    Number(digits[tens[2]] ?? 0),
                )
              : number));
        return `${normalized}号产线`;
      },
    );
}
function encodedValues(value: string): string[] | null {
  if (!value.startsWith(prefix) || value.length > 1_000_000) return null;
  try {
    const parsed: unknown = JSON.parse(value.slice(prefix.length));
    return Array.isArray(parsed) &&
      parsed.length <= 10_000 &&
      parsed.every(
        (item) =>
          typeof item === 'string' && item.length > 0 && item.length <= 1000,
      )
      ? unique(parsed)
      : null;
  } catch {
    return null;
  }
}
/** An empty list means all. Unknown or damaged values never silently become all. */
export function scopeValues(
  value: string | undefined,
  all: string,
  options: readonly string[] = [],
): string[] {
  if (!value || value === all) return [];
  if (value.startsWith(prefix)) return encodedValues(value) ?? [value];
  // A literal imported name containing punctuation takes precedence over legacy joined scopes.
  if (
    options.some(
      (option) => normalizeScopeName(option) === normalizeScopeName(value),
    )
  )
    return [value];
  const values = unique(value.split(/[、,，]/).map((item) => item.trim()));
  return values.length ? values : [value];
}
export function encodeScope(
  values: readonly string[],
  all: string,
  options?: readonly string[],
): string {
  const selected = unique(values.filter((value) => value !== all));
  if (!selected.length) return all;
  const available = options
    ? unique(options.filter((value) => value !== all))
    : [];
  if (
    available.length &&
    selected.length === available.length &&
    selected.every((value) => available.includes(value))
  )
    return all;
  return selected.length === 1 && !selected[0].startsWith(prefix)
    ? selected[0]
    : prefix + JSON.stringify(selected);
}
export function scopeLabel(value: string | undefined, all: string): string {
  if (!value || value === all) return all;
  if (!value.startsWith(prefix)) return value;
  const values = encodedValues(value);
  return values ? values.join('、') || all : '未识别的范围';
}
export function scopeButtonLabel(
  value: string | undefined,
  all: string,
  options: readonly string[],
): string {
  const values = scopeValues(value, all, options);
  return !values.length
    ? all
    : values.length === 1
      ? scopeLabel(value, all)
      : `已选 ${values.length} 项`;
}
export function filterScope<T>(
  items: T[],
  value: string | undefined,
  all: string,
  nameOf: (item: T) => string,
  normalize: (name: string) => string = normalizeScopeName,
): T[] {
  const names = items.map(nameOf);
  const values = scopeValues(value, all, names);
  if (!values.length) return items;
  const selected = new Set(values.map(normalize));
  return items.filter((item, index) => selected.has(normalize(names[index])));
}
/** Only encoded scope fields may exceed the existing free-text input limit. */
export function validInputString(key: string, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length <= 4000) return true;
  return (
    ['line', 'supplier', 'process'].includes(key) &&
    encodedValues(value) !== null
  );
}
/** A clear selection restores all; an explicit all option replaces any subset. */
export function nextScopeSelection(
  next: string[],
  previous: string[],
  all: string,
  options: string[],
): string {
  if (next.includes(all) && !previous.includes(all)) return all;
  return encodeScope(
    next.filter((value) => value !== all),
    all,
    options,
  );
}

/** Match whole known names, preferring longer names without swallowing explicit shorter mentions. */
export function mentionedScopeNames(
  question: string,
  names: readonly string[],
): string[] {
  let remaining = normalizeScopeName(question);
  const found: string[] = [];
  for (const name of unique(names).sort((a, b) => b.length - a.length)) {
    const token = normalizeScopeName(name);
    if (!token) continue;
    let index = remaining.indexOf(token);
    while (index >= 0) {
      const before = remaining[index - 1] ?? '';
      const after = remaining[index + token.length] ?? '';
      if (
        !(/[a-z0-9]/.test(token[0]) && /[a-z0-9]/.test(before)) &&
        !(/[a-z0-9]/.test(token.at(-1)!) && /[a-z0-9]/.test(after))
      ) {
        found.push(name);
        remaining =
          remaining.slice(0, index) +
          '\0'.repeat(token.length) +
          remaining.slice(index + token.length);
        break;
      }
      index = remaining.indexOf(token, index + 1);
    }
  }
  return found;
}
