import fixtures from './energy-fixtures.json';
import type { Dataset, Inputs } from './model';
import { dataFiles } from './data-files';
import { filterScope } from './scope';

export type EnergyReading = {
  date: string;
  line: string;
  shift: string;
  process: string;
  kwh: number;
  production: number;
  baseline: number;
};
export const energySampleReadings: EnergyReading[] = fixtures;
export const energySource = dataFiles[0];
export const energyPointThreshold = 20;
export type EnergyTrendGranularity = 'day' | 'month' | 'year';

const dayMillis = 24 * 60 * 60 * 1000;
function dateMillis(date: string) {
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) &&
    new Date(value).toISOString().slice(0, 10) === date
    ? value
    : Number.NaN;
}
function dateAfter(date: string, days: number) {
  const value = dateMillis(date);
  if (!Number.isFinite(value)) return date;
  return new Date(value + days * dayMillis).toISOString().slice(0, 10);
}

function summarize(rows: EnergyReading[]) {
  const batches = new Map<string, number>();
  for (const row of rows)
    batches.set(`${row.date}/${row.line}/${row.shift}`, row.production);
  const production = [...batches.values()].reduce((sum, n) => sum + n, 0);
  const total = rows.reduce((sum, row) => sum + row.kwh, 0);
  const baselineTotal = rows.reduce(
    (sum, row) => sum + row.production * row.baseline,
    0,
  );
  return {
    records: rows.length,
    total,
    production,
    unit: production ? total / production : 0,
    baseline: production ? baselineTotal / production : 0,
  };
}
function groupBy(
  rows: EnergyReading[],
  field: 'date' | 'line' | 'shift',
  granularity: EnergyTrendGranularity = 'day',
) {
  const groups = new Map<string, EnergyReading[]>();
  for (const row of rows) {
    const name =
      field === 'date'
        ? row.date.slice(
            0,
            granularity === 'year' ? 4 : granularity === 'month' ? 7 : 10,
          )
        : row[field];
    const group = groups.get(name);
    if (group) group.push(row);
    else groups.set(name, [row]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({ name, ...summarize(items) }));
}
export function energyDetailAnalysis(
  dataset: Dataset,
  input: Inputs,
  focus?: { date?: string; shift?: string },
) {
  // Imported aggregate records do not acquire synthetic dates or dimensions.
  if (dataset.origin !== 'sample' || !dataset.energyDetails?.length)
    return null;
  const readings = dataset.energyDetails;
  const dates = [...new Set(readings.map((row) => row.date))].sort();
  const availableStart = dates[0];
  const availableEnd = dates.at(-1)!;
  // An explicit question about one day overrides the dashboard date range.
  const rangeStart = focus?.date || input.dateFrom || availableStart;
  const rangeEnd = focus?.date || input.dateTo || availableEnd;
  const processRows = filterScope(
    readings,
    input.process,
    '全部工序',
    (row) => row.process,
  );
  const scopedRows = filterScope(
    processRows,
    input.line,
    '全部产线',
    (row) => row.line,
  );
  const rows = scopedRows.filter(
    (row) =>
      row.date >= rangeStart &&
      row.date <= rangeEnd &&
      (!focus?.shift || row.shift === focus.shift),
  );
  const summary = summarize(rows);
  const daily = groupBy(rows, 'date');
  const trendGranularity: EnergyTrendGranularity =
    input.granularity === 'month' || input.granularity === 'year'
      ? input.granularity
      : 'day';
  // Aggregate only records that exist; a month/year label does not imply full coverage.
  const trend = groupBy(rows, 'date', trendGranularity);
  const issues = rows
    .filter(
      (row) =>
        row.kwh >
        row.production * row.baseline * (1 + energyPointThreshold / 100),
    )
    .map((row) => ({
      ...row,
      unit: row.kwh / row.production,
      deviation: (row.kwh / row.production / row.baseline - 1) * 100,
    }));
  const days = daily.length;
  const start = daily[0]?.name ?? rangeStart;
  const end = daily.at(-1)?.name ?? rangeEnd;
  const rangeDuration = dateMillis(rangeEnd) - dateMillis(rangeStart);
  const calendarDays = Number.isFinite(rangeDuration)
    ? Math.max(0, Math.round(rangeDuration / dayMillis) + 1)
    : 0;
  const average = days ? summary.total / days : 0;
  const period = Number(input.period);
  const referenceProduction = days ? (summary.production / days) * period : 0;
  const explicitPlan = input.plannedProduction?.trim();
  const hasPlan = Boolean(
    explicitPlan &&
    Number.isFinite(Number(explicitPlan)) &&
    Number(explicitPlan) >= 0,
  );
  const parsedChange = Number(input.change || 0);
  const change = Number.isFinite(parsedChange) ? parsedChange : 0;
  const plannedProduction = hasPlan
    ? Number(explicitPlan)
    : referenceProduction * (1 + change / 100);
  const productionChange = referenceProduction
    ? (plannedProduction / referenceProduction - 1) * 100
    : 0;
  const forecastSource: 'plan' | 'change' | 'history' = hasPlan
    ? 'plan'
    : change !== 0
      ? 'change'
      : 'history';
  const projected = summary.unit * plannedProduction;
  const unchanged = summary.unit * referenceProduction;
  const forecastStart = dateAfter(end, 1);
  const forecastEnd = dateAfter(end, period);
  return {
    ...summary,
    rows,
    daily,
    trend,
    trendGranularity,
    issues,
    days,
    calendarDays,
    rangeStart,
    rangeEnd,
    availableStart,
    availableEnd,
    start,
    end,
    lines: groupBy(rows, 'line'),
    shifts: groupBy(rows, 'shift'),
    average,
    referenceProduction,
    plannedProduction,
    productionChange,
    forecastSource,
    projected,
    unchanged,
    forecastStart,
    forecastEnd,
    forecast: Array.from({ length: period + 1 }, (_, day) => ({
      day,
      label: `第${day}天`,
      date: dateAfter(end, day),
      baseline: ((unchanged / period) * day) / 1000,
      projected: ((projected / period) * day) / 1000,
    })),
  };
}
export type EnergyDetailAnalysis = NonNullable<
  ReturnType<typeof energyDetailAnalysis>
>;
