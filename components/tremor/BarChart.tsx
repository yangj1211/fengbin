// Adapted from Tremor, commit ca4d588f47820ff3d514d37fa4ee08a4222dec11. See NOTICE.md and LICENSE.
// Tremor BarChart [v1.0.0]
// Source: official Tremor, commit ca4d588f47820ff3d514d37fa4ee08a4222dec11.
// Modified for React 19 / Recharts 3.8 compatibility; optional per-bar colors,
// value labels, and legend interaction. Original implementation is Apache-2.0.
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React from 'react';
import {
  ChevronLeft as RiArrowLeftSLine,
  ChevronRight as RiArrowRightSLine,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Label,
  LabelList,
  BarChart as RechartsBarChart,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AxisDomain } from 'recharts/types/util/types';

import { useOnWindowResize } from './hooks/useOnWindowResize';
import {
  AvailableChartColors,
  type AvailableChartColorsKeys,
  constructCategoryColors,
  getColorClassName,
} from './utils/chartColors';
import { cx } from './utils/cx';
import { getYAxisDomain } from './utils/getYAxisDomain';

//#region Shape

function deepEqual<T>(obj1: T, obj2: T): boolean {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1) as Array<keyof T>;
  const keys2 = Object.keys(obj2) as Array<keyof T>;

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

const renderShape = (
  props: any,
  activeBar: any | undefined,
  activeLegend: string | undefined,
  layout: string,
  category: string,
  barColor?: (
    item: Record<string, any>,
    category: string,
  ) => string | undefined,
  keyboardProps?: Pick<
    React.SVGProps<SVGRectElement>,
    'role' | 'tabIndex' | 'aria-label' | 'onKeyDown' | 'className'
  >,
) => {
  const { fillOpacity, payload, value } = props;
  let { x, width, y, height } = props;

  if (layout === 'horizontal' && height < 0) {
    y += height;
    height = Math.abs(height); // height must be a positive number
  } else if (layout === 'vertical' && width < 0) {
    x += width;
    width = Math.abs(width); // width must be a positive number
  }

  return (
    <rect
      {...keyboardProps}
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ fill: barColor?.(payload, category) }}
      opacity={
        activeBar || (activeLegend && activeLegend !== category)
          ? deepEqual(activeBar, { ...payload, value })
            ? fillOpacity
            : 0.3
          : fillOpacity
      }
    />
  );
};

//#region Legend

interface LegendItemProps {
  name: string;
  color: AvailableChartColorsKeys;
  onClick?: (name: string, color: AvailableChartColorsKeys) => void;
  activeLegend?: string;
}

const LegendItem = ({
  name,
  color,
  onClick,
  activeLegend,
}: LegendItemProps) => {
  const hasOnValueChange = !!onClick;
  return (
    <li
      className={cx(
        // base
        'group inline-flex flex-nowrap items-center gap-1.5 rounded-sm px-2 py-1 whitespace-nowrap transition',
        hasOnValueChange
          ? 'cursor-pointer hover:bg-[var(--muted)]'
          : 'cursor-default',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(name, color);
      }}
    >
      <span
        className={cx(
          'size-2 shrink-0 rounded-xs',
          getColorClassName(color, 'bg'),
          activeLegend && activeLegend !== name ? 'opacity-40' : 'opacity-100',
        )}
        aria-hidden={true}
      />
      <p
        className={cx(
          // base
          'truncate text-xs whitespace-nowrap',
          // text color
          'text-[var(--muted-foreground)]',
          hasOnValueChange && 'group-hover:text-current',
          activeLegend && activeLegend !== name ? 'opacity-40' : 'opacity-100',
        )}
      >
        {name}
      </p>
    </li>
  );
};

interface ScrollButtonProps {
  icon: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
}

const ScrollButton = ({ icon, onClick, disabled }: ScrollButtonProps) => {
  const Icon = icon;
  const [isPressed, setIsPressed] = React.useState(false);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isPressed) {
      intervalRef.current = setInterval(() => {
        onClick?.();
      }, 300);
    } else {
      clearInterval(intervalRef.current as NodeJS.Timeout);
    }
    return () => clearInterval(intervalRef.current as NodeJS.Timeout);
  }, [isPressed, onClick]);

  React.useEffect(() => {
    if (disabled) {
      clearInterval(intervalRef.current as NodeJS.Timeout);
      setIsPressed(false);
    }
  }, [disabled]);

  return (
    <button
      type="button"
      className={cx(
        // base
        'group inline-flex size-5 items-center truncate rounded-sm transition',
        disabled
          ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
          : 'cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50',
      )}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setIsPressed(true);
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        setIsPressed(false);
      }}
    >
      <Icon className="size-full" aria-hidden="true" />
    </button>
  );
};

interface LegendProps extends React.OlHTMLAttributes<HTMLOListElement> {
  categories: string[];
  colors?: AvailableChartColorsKeys[];
  onClickLegendItem?: (category: string, color: string) => void;
  activeLegend?: string;
  enableLegendSlider?: boolean;
}

type HasScrollProps = {
  left: boolean;
  right: boolean;
};

const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
  const {
    categories,
    colors = AvailableChartColors,
    className,
    onClickLegendItem,
    activeLegend,
    enableLegendSlider = false,
    ...other
  } = props;
  const scrollableRef = React.useRef<HTMLDivElement>(null);
  const scrollButtonsRef = React.useRef<HTMLDivElement>(null);
  const [hasScroll, setHasScroll] = React.useState<HasScrollProps | null>(null);
  const [isKeyDowned, setIsKeyDowned] = React.useState<string | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const checkScroll = React.useCallback(() => {
    const scrollable = scrollableRef?.current;
    if (!scrollable) return;

    const hasLeftScroll = scrollable.scrollLeft > 0;
    const hasRightScroll =
      scrollable.scrollWidth - scrollable.clientWidth > scrollable.scrollLeft;

    setHasScroll({ left: hasLeftScroll, right: hasRightScroll });
  }, [setHasScroll]);

  const scrollToTest = React.useCallback(
    (direction: 'left' | 'right') => {
      const element = scrollableRef?.current;
      const scrollButtons = scrollButtonsRef?.current;
      const scrollButtonsWith = scrollButtons?.clientWidth ?? 0;
      const width = element?.clientWidth ?? 0;

      if (element && enableLegendSlider) {
        element.scrollTo({
          left:
            direction === 'left'
              ? element.scrollLeft - width + scrollButtonsWith
              : element.scrollLeft + width - scrollButtonsWith,
          behavior: 'smooth',
        });
        setTimeout(() => {
          checkScroll();
        }, 400);
      }
    },
    [enableLegendSlider, checkScroll],
  );

  React.useEffect(() => {
    const keyDownHandler = (key: string) => {
      if (key === 'ArrowLeft') {
        scrollToTest('left');
      } else if (key === 'ArrowRight') {
        scrollToTest('right');
      }
    };
    if (isKeyDowned) {
      keyDownHandler(isKeyDowned);
      intervalRef.current = setInterval(() => {
        keyDownHandler(isKeyDowned);
      }, 300);
    } else {
      clearInterval(intervalRef.current as NodeJS.Timeout);
    }
    return () => clearInterval(intervalRef.current as NodeJS.Timeout);
  }, [isKeyDowned, scrollToTest]);

  const keyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setIsKeyDowned(e.key);
    }
  };
  const keyUp = (e: KeyboardEvent) => {
    e.stopPropagation();
    setIsKeyDowned(null);
  };

  React.useEffect(() => {
    const scrollable = scrollableRef?.current;
    if (enableLegendSlider) {
      checkScroll();
      scrollable?.addEventListener('keydown', keyDown);
      scrollable?.addEventListener('keyup', keyUp);
    }

    return () => {
      scrollable?.removeEventListener('keydown', keyDown);
      scrollable?.removeEventListener('keyup', keyUp);
    };
  }, [checkScroll, enableLegendSlider]);

  return (
    <ol
      ref={ref}
      className={cx('relative overflow-hidden', className)}
      {...other}
    >
      <div
        ref={scrollableRef}
        tabIndex={0}
        className={cx(
          'flex h-full',
          enableLegendSlider
            ? hasScroll?.right || hasScroll?.left
              ? 'snap-mandatory items-center overflow-auto pr-12 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : ''
            : 'flex-wrap',
        )}
      >
        {categories.map((category, index) => (
          <LegendItem
            key={`item-${index}`}
            name={category}
            color={colors[index] as AvailableChartColorsKeys}
            onClick={onClickLegendItem}
            activeLegend={activeLegend}
          />
        ))}
      </div>
      {enableLegendSlider && (hasScroll?.right || hasScroll?.left) ? (
        <>
          <div
            className={cx(
              // base
              'absolute top-0 right-0 bottom-0 flex h-full items-center justify-center pr-1',
              // background color
              'bg-[var(--dashboard-surface)]',
            )}
          >
            <ScrollButton
              icon={RiArrowLeftSLine}
              onClick={() => {
                setIsKeyDowned(null);
                scrollToTest('left');
              }}
              disabled={!hasScroll?.left}
            />
            <ScrollButton
              icon={RiArrowRightSLine}
              onClick={() => {
                setIsKeyDowned(null);
                scrollToTest('right');
              }}
              disabled={!hasScroll?.right}
            />
          </div>
        </>
      ) : null}
    </ol>
  );
});

Legend.displayName = 'Legend';

const ChartLegend = (
  { payload }: any,
  categoryColors: Map<string, AvailableChartColorsKeys>,
  setLegendHeight: React.Dispatch<React.SetStateAction<number>>,
  activeLegend: string | undefined,
  onClick?: (category: string, color: string) => void,
  enableLegendSlider?: boolean,
  legendPosition?: 'left' | 'center' | 'right',
  yAxisWidth?: number,
) => {
  const legendRef = React.useRef<HTMLDivElement>(null);

  useOnWindowResize(() => {
    const calculateHeight = (height: number | undefined) =>
      height ? Number(height) + 15 : 60;
    setLegendHeight(calculateHeight(legendRef.current?.clientHeight));
  });

  const filteredPayload = (payload ?? []).filter(
    (item: any) => item.type !== 'none',
  );

  const paddingLeft =
    legendPosition === 'left' && yAxisWidth ? yAxisWidth - 8 : 0;

  return (
    <div
      style={{ paddingLeft: paddingLeft }}
      ref={legendRef}
      className={cx(
        'flex items-center',
        { 'justify-center': legendPosition === 'center' },
        {
          'justify-start': legendPosition === 'left',
        },
        { 'justify-end': legendPosition === 'right' },
      )}
    >
      <Legend
        categories={filteredPayload.map((entry: any) => entry.value)}
        colors={filteredPayload.map((entry: any) =>
          categoryColors.get(entry.value),
        )}
        onClickLegendItem={onClick}
        activeLegend={activeLegend}
        enableLegendSlider={enableLegendSlider}
      />
    </div>
  );
};

//#region Tooltip

type TooltipProps = Pick<ChartTooltipProps, 'active' | 'payload' | 'label'>;

type PayloadItem = {
  category: string;
  value: number;
  index: string;
  color: AvailableChartColorsKeys;
  colorValue?: string;
  type?: string;
  payload: any;
};

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  label: string;
  valueFormatter: (value: number) => string;
}

const ChartTooltip = ({
  active,
  payload,
  label,
  valueFormatter,
}: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        className={cx(
          // base
          'rounded-md border text-sm shadow-sm',
          // border color
          'border-[var(--border)]',
          // background color
          'bg-[var(--dashboard-surface)]',
        )}
      >
        <div className={cx('border-b border-inherit px-4 py-2')}>
          <p
            className={cx(
              // base
              'font-medium',
              // text color
              'text-inherit',
            )}
          >
            {label}
          </p>
        </div>
        <div className={cx('space-y-1 px-4 py-2')}>
          {payload.map(({ value, category, color, colorValue }, index) => (
            <div
              key={`id-${index}`}
              className="flex items-center justify-between space-x-8"
            >
              <div className="flex items-center space-x-2">
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: colorValue }}
                  className={cx(
                    'size-2 shrink-0 rounded-xs',
                    getColorClassName(color, 'bg'),
                  )}
                />
                <p
                  className={cx(
                    // base
                    'text-right whitespace-nowrap',
                    // text color
                    'text-[var(--muted-foreground)]',
                  )}
                >
                  {category}
                </p>
              </div>
              <p
                className={cx(
                  // base
                  'text-right font-medium whitespace-nowrap tabular-nums',
                  // text color
                  'text-inherit',
                )}
              >
                {valueFormatter(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

//#region BarChart

type BaseEventProps = {
  eventType: 'category' | 'bar';
  categoryClicked: string;
  [key: string]: number | string;
};

type BarChartEventProps = BaseEventProps | null | undefined;

interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[];
  index: string;
  categories: string[];
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  categoryFormatter?: (value: string) => string;
  startEndOnly?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  yAxisWidth?: number;
  intervalType?: 'preserveStartEnd' | 'equidistantPreserveStart';
  showTooltip?: boolean;
  showLegend?: boolean;
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  allowDecimals?: boolean;
  onValueChange?: (value: BarChartEventProps) => void;
  enableLegendSlider?: boolean;
  enableLegendInteraction?: boolean;
  barColor?: (
    item: Record<string, any>,
    category: string,
  ) => string | undefined;
  showValueLabels?: boolean;
  tickGap?: number;
  barCategoryGap?: string | number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  layout?: 'vertical' | 'horizontal';
  type?: 'default' | 'stacked' | 'percent';
  legendPosition?: 'left' | 'center' | 'right';
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void;
  customTooltip?: React.ComponentType<TooltipProps>;
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  (props, forwardedRef) => {
    const {
      data = [],
      categories = [],
      index,
      colors = AvailableChartColors,
      valueFormatter = (value: number) => value.toString(),
      categoryFormatter,
      startEndOnly = false,
      showXAxis = true,
      showYAxis = true,
      showGridLines = true,
      yAxisWidth = 56,
      intervalType = 'equidistantPreserveStart',
      showTooltip = true,
      showLegend = true,
      autoMinValue = false,
      minValue,
      maxValue,
      allowDecimals = true,
      className,
      onValueChange,
      enableLegendSlider = false,
      enableLegendInteraction = true,
      barColor,
      showValueLabels = false,
      barCategoryGap,
      tickGap = 5,
      xAxisLabel,
      yAxisLabel,
      layout = 'horizontal',
      type = 'default',
      legendPosition = 'right',
      tooltipCallback,
      customTooltip,
      ...other
    } = props;
    const CustomTooltip = customTooltip;
    const paddingValue =
      (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20;
    const [legendHeight, setLegendHeight] = React.useState(60);
    const [activeLegend, setActiveLegend] = React.useState<string | undefined>(
      undefined,
    );
    const categoryColors = constructCategoryColors(categories, colors);
    const [activeBar, setActiveBar] = React.useState<any | undefined>(
      undefined,
    );
    const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
    const hasOnValueChange = !!onValueChange;
    const stacked = type === 'stacked' || type === 'percent';

    const prevActiveRef = React.useRef<boolean | undefined>(undefined);
    const prevLabelRef = React.useRef<string | undefined>(undefined);

    function valueToPercent(value: number) {
      return `${(value * 100).toFixed(0)}%`;
    }

    function onBarClick(
      category: string,
      data: any,
      _: number,
      event: React.SyntheticEvent,
    ) {
      event.stopPropagation();
      if (!onValueChange) return;
      if (deepEqual(activeBar, { ...data.payload, value: data.value })) {
        setActiveLegend(undefined);
        setActiveBar(undefined);
        onValueChange?.(null);
      } else {
        setActiveLegend(category);
        setActiveBar({
          ...data.payload,
          value: data.value,
        });
        onValueChange?.({
          eventType: 'bar',
          categoryClicked: category,
          ...data.payload,
        });
      }
    }

    function onCategoryClick(dataKey: string) {
      if (!hasOnValueChange || !enableLegendInteraction) return;
      if (dataKey === activeLegend && !activeBar) {
        setActiveLegend(undefined);
        onValueChange?.(null);
      } else {
        setActiveLegend(dataKey);
        onValueChange?.({
          eventType: 'category',
          categoryClicked: dataKey,
        });
      }
      setActiveBar(undefined);
    }

    return (
      <div
        ref={forwardedRef}
        className={cx('h-80 w-full', className)}
        tremor-id="tremor-raw"
        {...other}
      >
        <ResponsiveContainer
          minWidth={0}
          initialDimension={{ width: 480, height: 300 }}
        >
          <RechartsBarChart
            data={data}
            onClick={
              hasOnValueChange && (activeLegend || activeBar)
                ? () => {
                    setActiveBar(undefined);
                    setActiveLegend(undefined);
                    onValueChange?.(null);
                  }
                : undefined
            }
            margin={{
              bottom: xAxisLabel ? 30 : undefined,
              left: yAxisLabel ? 20 : undefined,
              right:
                showValueLabels && layout === 'vertical'
                  ? 56
                  : yAxisLabel
                    ? 5
                    : undefined,
              top: showValueLabels && layout === 'horizontal' ? 24 : 5,
            }}
            stackOffset={type === 'percent' ? 'expand' : undefined}
            layout={layout}
            barCategoryGap={barCategoryGap}
          >
            {showGridLines ? (
              <CartesianGrid
                className={cx('stroke-[var(--border)] stroke-1')}
                horizontal={layout !== 'vertical'}
                vertical={layout === 'vertical'}
              />
            ) : null}
            <XAxis
              hide={!showXAxis}
              tick={{
                transform:
                  layout !== 'vertical' ? 'translate(0, 6)' : undefined,
              }}
              fill=""
              stroke=""
              className={cx(
                // base
                'text-xs',
                // text fill
                'fill-[var(--muted-foreground)]',
                { 'mt-4': layout !== 'vertical' },
              )}
              tickLine={false}
              axisLine={false}
              minTickGap={tickGap}
              {...(layout !== 'vertical'
                ? {
                    padding: {
                      left: paddingValue,
                      right: paddingValue,
                    },
                    dataKey: index,
                    tickFormatter: categoryFormatter,
                    interval: startEndOnly ? 'preserveStartEnd' : intervalType,
                    ticks:
                      startEndOnly && data.length > 0
                        ? [data[0][index], data[data.length - 1][index]]
                        : undefined,
                  }
                : {
                    type: 'number',
                    domain: yAxisDomain as AxisDomain,
                    tickFormatter:
                      type === 'percent' ? valueToPercent : valueFormatter,
                    allowDecimals: allowDecimals,
                  })}
            >
              {xAxisLabel && (
                <Label
                  position="insideBottom"
                  offset={-20}
                  className="fill-current text-sm font-medium"
                >
                  {xAxisLabel}
                </Label>
              )}
            </XAxis>
            <YAxis
              width={yAxisWidth}
              hide={!showYAxis}
              axisLine={false}
              tickLine={false}
              fill=""
              stroke=""
              className={cx(
                // base
                'text-xs',
                // text fill
                'fill-[var(--muted-foreground)]',
              )}
              tick={{
                transform:
                  layout !== 'vertical'
                    ? 'translate(-3, 0)'
                    : 'translate(0, 0)',
              }}
              {...(layout !== 'vertical'
                ? {
                    type: 'number',
                    domain: yAxisDomain as AxisDomain,
                    tickFormatter:
                      type === 'percent' ? valueToPercent : valueFormatter,
                    allowDecimals: allowDecimals,
                  }
                : {
                    dataKey: index,
                    tickFormatter: categoryFormatter,
                    ticks:
                      startEndOnly && data.length > 0
                        ? [data[0][index], data[data.length - 1][index]]
                        : undefined,
                    type: 'category',
                    interval: 'equidistantPreserveStart',
                  })}
            >
              {yAxisLabel && (
                <Label
                  position="insideLeft"
                  style={{ textAnchor: 'middle' }}
                  angle={-90}
                  offset={-15}
                  className="fill-current text-sm font-medium"
                >
                  {yAxisLabel}
                </Label>
              )}
            </YAxis>
            <Tooltip
              wrapperStyle={{ outline: 'none' }}
              isAnimationActive={false}
              cursor={{ fill: '#d1d5db', opacity: '0.15' }}
              offset={20}
              position={{
                y: layout === 'horizontal' ? 0 : undefined,
                x: layout === 'horizontal' ? undefined : yAxisWidth + 20,
              }}
              content={({ active, payload, label }) => {
                const tooltipLabel = label == null ? '' : String(label);
                const cleanPayload: TooltipProps['payload'] = payload
                  ? payload.map((item: any) => ({
                      category: item.dataKey,
                      value: item.value,
                      index: item.payload[index],
                      color: categoryColors.get(
                        item.dataKey,
                      ) as AvailableChartColorsKeys,
                      colorValue: barColor?.(
                        item.payload,
                        String(item.dataKey),
                      ),
                      type: item.type,
                      payload: item.payload,
                    }))
                  : [];

                if (
                  tooltipCallback &&
                  (active !== prevActiveRef.current ||
                    tooltipLabel !== prevLabelRef.current)
                ) {
                  tooltipCallback({
                    active,
                    payload: cleanPayload,
                    label: tooltipLabel,
                  });
                  prevActiveRef.current = active;
                  prevLabelRef.current = tooltipLabel;
                }

                return showTooltip && active ? (
                  CustomTooltip ? (
                    <CustomTooltip
                      active={active}
                      payload={cleanPayload}
                      label={tooltipLabel}
                    />
                  ) : (
                    <ChartTooltip
                      active={active}
                      payload={cleanPayload}
                      label={tooltipLabel}
                      valueFormatter={valueFormatter}
                    />
                  )
                ) : null;
              }}
            />
            {showLegend ? (
              <RechartsLegend
                verticalAlign="top"
                height={legendHeight}
                content={({ payload }) =>
                  ChartLegend(
                    { payload },
                    categoryColors,
                    setLegendHeight,
                    activeLegend,
                    hasOnValueChange && enableLegendInteraction
                      ? (clickedLegendItem: string) =>
                          onCategoryClick(clickedLegendItem)
                      : undefined,
                    enableLegendSlider,
                    legendPosition,
                    yAxisWidth,
                  )
                }
              />
            ) : null}
            {categories.map((category) => (
              <Bar
                className={cx(
                  getColorClassName(
                    categoryColors.get(category) as AvailableChartColorsKeys,
                    'fill',
                  ),
                  onValueChange ? 'cursor-pointer' : '',
                )}
                key={category}
                name={category}
                dataKey={category}
                stackId={stacked ? 'stack' : undefined}
                isAnimationActive={false}
                fill=""
                shape={(props: any) =>
                  renderShape(
                    props,
                    activeBar,
                    activeLegend,
                    layout,
                    category,
                    barColor,
                    hasOnValueChange
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          className: 'tremor-bar-target',
                          'aria-label': `${String(props.payload?.[index] ?? '')}，${category}：${valueFormatter(Number(props.payload?.[category]))}，查看明细`,
                          onKeyDown: (event) => {
                            if (event.key !== 'Enter' && event.key !== ' ')
                              return;
                            event.preventDefault();
                            event.stopPropagation();
                            if (event.repeat) return;
                            // SVG rect has no native keyboard click. Keep mouse
                            // activation on the existing Recharts Bar handler.
                            onBarClick(category, props, props.index, event);
                          },
                        }
                      : undefined,
                  )
                }
                onClick={(data, itemIndex, event) =>
                  onBarClick(category, data, itemIndex, event)
                }
              >
                {showValueLabels && (
                  <LabelList
                    dataKey={category}
                    position={layout === 'horizontal' ? 'top' : 'right'}
                    className="fill-gray-700 text-xs dark:fill-gray-300"
                    formatter={(labelValue) => {
                      if (labelValue == null || labelValue === '') return '';
                      const numericValue = Number(labelValue);
                      return Number.isFinite(numericValue)
                        ? valueFormatter(numericValue)
                        : labelValue;
                    }}
                  />
                )}
              </Bar>
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

BarChart.displayName = 'BarChart';

export { BarChart, type BarChartEventProps, type TooltipProps };
