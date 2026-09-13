'use client';
// Adapted from Tremor, commit ca4d588f47820ff3d514d37fa4ee08a4222dec11. See NOTICE.md and LICENSE.
// Tremor BarList [v1.0.0]

import React from 'react';

import { cx } from './utils/cx';
import { focusRing } from './utils/focusRing';

type Bar<T> = T & {
  key?: string;
  href?: string;
  value: number;
  name: string;
  color?: string;
};

interface BarListProps<
  T = unknown,
> extends React.HTMLAttributes<HTMLDivElement> {
  data: Bar<T>[];
  maxValue?: number;
  valueFormatter?: (value: number) => string;
  showAnimation?: boolean;
  onValueChange?: (payload: Bar<T>) => void;
  sortOrder?: 'ascending' | 'descending' | 'none';
}

function BarListInner<T>(
  {
    data = [],
    maxValue: suppliedMaxValue,
    valueFormatter = (value) => value.toString(),
    showAnimation = false,
    onValueChange,
    sortOrder = 'descending',
    className,
    ...props
  }: BarListProps<T>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const Component = onValueChange ? 'button' : 'div';
  const sortedData = React.useMemo(() => {
    if (sortOrder === 'none') {
      return data;
    }
    return [...data].sort((a, b) => {
      return sortOrder === 'ascending' ? a.value - b.value : b.value - a.value;
    });
  }, [data, sortOrder]);

  const widths = React.useMemo(() => {
    const maxValue = Math.max(
      ...sortedData.map((item) => item.value),
      suppliedMaxValue ?? 0,
    );
    return sortedData.map((item) =>
      item.value === 0 ? 0 : Math.max((item.value / maxValue) * 100, 2),
    );
  }, [sortedData, suppliedMaxValue]);

  const rowHeight = 'h-8';

  return (
    <div
      ref={forwardedRef}
      className={cx('flex justify-between space-x-6', className)}
      data-sort={sortOrder}
      tremor-id="tremor-raw"
      {...props}
    >
      <div className="relative w-full space-y-1.5">
        {sortedData.map((item, index) => (
          <Component
            key={item.key ?? item.name}
            type={onValueChange ? 'button' : undefined}
            aria-label={`${item.name}：${valueFormatter(item.value)}`}
            title={item.name}
            onClick={() => {
              onValueChange?.(item);
            }}
            className={cx(
              // base
              'group w-full rounded-sm',
              // focus
              focusRing,
              onValueChange
                ? [
                    '-m-0! cursor-pointer',
                    // hover
                    'hover:bg-[var(--muted)]',
                  ]
                : '',
            )}
          >
            <div
              className={cx(
                // base
                'flex items-center rounded-sm transition-all',
                rowHeight,
                // background color
                'bg-[color-mix(in_srgb,var(--dashboard-accent)_24%,transparent)]',
                onValueChange ? 'group-hover:brightness-125' : '',
                // margin and duration
                {
                  'mb-0': index === sortedData.length - 1,
                  'duration-800': showAnimation,
                },
              )}
              style={{ width: `${widths[index]}%`, background: item.color }}
            >
              <div className={cx('absolute left-2 flex max-w-full pr-2')}>
                {item.href ? (
                  <a
                    href={item.href}
                    className={cx(
                      // base
                      'truncate whitespace-nowrap rounded-sm text-sm',
                      // text color
                      'text-inherit',
                      // hover
                      'hover:underline hover:underline-offset-2',
                      // focus
                      focusRing,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {item.name}
                  </a>
                ) : (
                  <p
                    className={cx(
                      // base
                      'truncate whitespace-nowrap text-sm',
                      // text color
                      'text-inherit',
                    )}
                  >
                    {item.name}
                  </p>
                )}
              </div>
            </div>
          </Component>
        ))}
      </div>
      <div>
        {sortedData.map((item, index) => (
          <div
            key={item.key ?? item.name}
            className={cx(
              'flex items-center justify-end',
              rowHeight,
              index === sortedData.length - 1 ? 'mb-0' : 'mb-1.5',
            )}
          >
            <p
              className={cx(
                // base
                'truncate whitespace-nowrap text-sm leading-none',
                // text color
                'text-inherit',
              )}
            >
              {valueFormatter(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

BarListInner.displayName = 'BarList';

const BarList = React.forwardRef(BarListInner) as <T>(
  p: BarListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof BarListInner>;

export { BarList, type BarListProps };
