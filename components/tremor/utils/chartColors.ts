// Tremor chartColors [v0.1.0]

export type ColorUtility = 'bg' | 'stroke' | 'fill' | 'text';

// Local adaptation: semantic colors preserve the application palette.
export const chartColors = {
  actual: {
    bg: 'bg-[var(--dashboard-accent)]',
    stroke: 'stroke-[var(--dashboard-accent)]',
    fill: 'fill-[var(--dashboard-accent)]',
    text: 'text-[var(--dashboard-accent)]',
  },
  reference: {
    bg: 'bg-[var(--dashboard-reference)]',
    stroke: 'stroke-[var(--dashboard-reference)]',
    fill: 'fill-[var(--dashboard-reference)]',
    text: 'text-[var(--dashboard-reference)]',
  },
  planned: {
    bg: 'bg-[var(--dashboard-planned)]',
    stroke: 'stroke-[var(--dashboard-planned)]',
    fill: 'fill-[var(--dashboard-planned)]',
    text: 'text-[var(--dashboard-planned)]',
  },
  warning: {
    bg: 'bg-[var(--dashboard-warning)]',
    stroke: 'stroke-[var(--dashboard-warning)]',
    fill: 'fill-[var(--dashboard-warning)]',
    text: 'text-[var(--dashboard-warning)]',
  },

  blue: {
    bg: 'bg-blue-500',
    stroke: 'stroke-blue-500',
    fill: 'fill-blue-500',
    text: 'text-blue-500',
  },
  emerald: {
    bg: 'bg-emerald-500',
    stroke: 'stroke-emerald-500',
    fill: 'fill-emerald-500',
    text: 'text-emerald-500',
  },
  violet: {
    bg: 'bg-violet-500',
    stroke: 'stroke-violet-500',
    fill: 'fill-violet-500',
    text: 'text-violet-500',
  },
  amber: {
    bg: 'bg-amber-500',
    stroke: 'stroke-amber-500',
    fill: 'fill-amber-500',
    text: 'text-amber-500',
  },
  gray: {
    bg: 'bg-gray-500',
    stroke: 'stroke-gray-500',
    fill: 'fill-gray-500',
    text: 'text-gray-500',
  },
  cyan: {
    bg: 'bg-cyan-500',
    stroke: 'stroke-cyan-500',
    fill: 'fill-cyan-500',
    text: 'text-cyan-500',
  },
  pink: {
    bg: 'bg-pink-500',
    stroke: 'stroke-pink-500',
    fill: 'fill-pink-500',
    text: 'text-pink-500',
  },
  lime: {
    bg: 'bg-lime-500',
    stroke: 'stroke-lime-500',
    fill: 'fill-lime-500',
    text: 'text-lime-500',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500',
    stroke: 'stroke-fuchsia-500',
    fill: 'fill-fuchsia-500',
    text: 'text-fuchsia-500',
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string;
  };
};

export type AvailableChartColorsKeys = keyof typeof chartColors;

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>;

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: 'bg-gray-500',
    stroke: 'stroke-gray-500',
    fill: 'fill-gray-500',
    text: 'text-gray-500',
  };
  return chartColors[color]?.[type] ?? fallbackColor[type];
};
