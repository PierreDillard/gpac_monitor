import type {
  ParsedFilterStatus,
  StatusEntry,
  StatusScalar,
  StatusNum,
  StatusStr,
  StatusBool,
  StatusArray,
} from '@/utils/metrics/filterStatusParser';
import { formatFps, formatFractionAsTimeWithRaw } from '@/utils/formatting';
import { isGraphableStatusMetric } from '@/utils/metrics/statusMetricGraph';

export type ProgressBar = {
  key: string;
  valueLabel: string;
  percentage: number;
};

export type NumericMetric = {
  key: string;
  value: string;
  tooltip?: string;
  /** Real numeric value (null for fractions / non-finite values), source for charting. */
  rawValue: number | null;
  /** True when this metric is worth plotting on a time-series chart. */
  graphable: boolean;
  /** True when all metrics in this status represent a completion snapshot (done flag present). */
  completionSnapshot?: boolean;
};

export type StateBadge = {
  key: string;
  label: string;
  styleKey: string;
};

export type ArrayMetric = { key: string; value: string; tooltip?: string };

export type ArrayItem = {
  key: string;
  name: string;
  type?: string;
  metrics: ArrayMetric[];
  progress?: number;
};

export type ArrayGroup = {
  key: string;
  label: string;
  items: ArrayItem[];
};

export type TextMetric = {
  key: string;
  value: string;
  quoted: boolean;
};

export type BufferMetric = {
  key: 'buffer';
  current: number;
  max: number;
  unit: 'ms';
  percentage: number;
};

export type FilterStatusViewModel = {
  info?: string;
  primaryProgress?: ProgressBar;
  buffer?: BufferMetric;
  numericMetrics: NumericMetric[];
  textMetrics: TextMetric[];
  stateBadges: StateBadge[];
  arrays: ArrayGroup[];
  completionDone?: boolean;
};

export type StatusGroups = FilterStatusViewModel;

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getFractionPercentage(entry: StatusNum): number | null {
  if (!entry.fraction || entry.fraction.den <= 0) return null;
  return clampPercentage((entry.fraction.num / entry.fraction.den) * 100);
}

function getProgressPercentage(entry: StatusNum): number | null {
  if (entry.fraction) return getFractionPercentage(entry);
  if (!Number.isFinite(entry.value)) return null;
  return clampPercentage(entry.value);
}

function isInfoEntry(entry: StatusEntry): entry is StatusStr {
  return entry.type === 'str' && entry.key === 'info';
}

function isProgressEntry(entry: StatusEntry): entry is StatusNum {
  return entry.type === 'num' && entry.key === 'prog';
}

function isExplicitPercentEntry(entry: StatusNum): boolean {
  return (
    entry.key === 'pc' ||
    entry.unit === 'pc' ||
    entry.unit === 'percent' ||
    entry.unit === '%'
  );
}

function isBufferEntry(entry: StatusEntry): entry is StatusNum {
  return (
    entry.type === 'num' &&
    entry.key === 'buffer' &&
    Boolean((entry as StatusNum).fraction) &&
    (entry as StatusNum).unit === 'ms'
  );
}

function isTimeEntry(entry: StatusNum): boolean {
  return entry.key === 'time';
}

function isTextMetricEntry(entry: StatusEntry): entry is StatusStr {
  if (entry.type !== 'str' || entry.key === 'info') return false;
  return entry.quoted || /\d/.test(entry.value);
}

function isStateBadgeEntry(
  entry: StatusEntry,
): entry is StatusBool | StatusStr {
  if (entry.type === 'bool') return true;
  if (entry.type !== 'str') return false;
  return entry.key !== 'info' && !entry.quoted && !/\d/.test(entry.value);
}

function normalizeStyleKey(value: string): string {
  return value.trim().toLowerCase();
}

function formatNumericValue(entry: StatusNum): string {
  if (entry.fraction) {
    return `${entry.fraction.num} / ${entry.fraction.den}`;
  }
  return Number.isInteger(entry.value)
    ? String(entry.value)
    : entry.value.toFixed(2);
}

function toProgressBar(entry: StatusNum): ProgressBar {
  if (entry.fraction) {
    const { num, den } = entry.fraction;
    const percentage = den > 0 ? clampPercentage((num / den) * 100) : 0;
    return { key: entry.key, valueLabel: `${num} / ${den}`, percentage };
  }
  const percentage = clampPercentage(entry.value);
  return {
    key: entry.key,
    valueLabel: `${Math.round(percentage)}%`,
    percentage,
  };
}

function toBufferMetric(entry: StatusNum): BufferMetric {
  if (!entry.fraction) {
    throw new Error(
      'toBufferMetric called on an entry without a fraction (isBufferEntry guarantees this)',
    );
  }
  const { num, den } = entry.fraction;
  const percentage = den > 0 ? clampPercentage((num / den) * 100) : 0;
  return { key: 'buffer', current: num, max: den, unit: 'ms', percentage };
}

function graphFields(entry: StatusNum): {
  rawValue: number | null;
  graphable: boolean;
} {
  const rawValue =
    entry.fraction || !Number.isFinite(entry.value) ? null : entry.value;
  return { rawValue, graphable: isGraphableStatusMetric(entry) };
}

function toNumericMetric(entry: StatusNum): NumericMetric {
  const graph = graphFields(entry);
  if (entry.key === 'fps' || entry.unit === 'fps') {
    return { key: entry.key, value: formatFps(entry.value), ...graph };
  }
  if (isTimeEntry(entry) && entry.fraction) {
    const { num, den } = entry.fraction;
    return {
      key: entry.key,
      value: formatFractionAsTimeWithRaw(num, den),
      ...graph,
    };
  }
  if (isExplicitPercentEntry(entry)) {
    const formatted = Number.isInteger(entry.value)
      ? String(entry.value)
      : entry.value < 1
        ? entry.value.toFixed(2)
        : entry.value.toFixed(1);
    return { key: entry.key, value: `${formatted}%`, ...graph };
  }
  const formattedValue = formatNumericValue(entry);
  return {
    key: entry.key,
    value: entry.unit ? `${formattedValue} ${entry.unit}` : formattedValue,
    ...graph,
  };
}

function toStateBadge(entry: StatusBool | StatusStr): StateBadge {
  const label = entry.type === 'bool' ? entry.key : (entry as StatusStr).value;
  return { key: entry.key, label, styleKey: normalizeStyleKey(label) };
}

function scalarValueStr(entry: StatusScalar): string {
  if (entry.type === 'bool') return '●';
  if (entry.type === 'str') return entry.value;
  const num = entry as StatusNum;
  const unit = num.unit ? ` ${num.unit}` : '';
  if (num.fraction) {
    if (isTimeEntry(num))
      return formatFractionAsTimeWithRaw(num.fraction.num, num.fraction.den);
    return `${num.fraction.num}/${num.fraction.den}${unit}`;
  }
  return `${Number.isInteger(num.value) ? String(num.value) : num.value.toFixed(2)}${unit}`;
}

function toArrayItem(item: {
  name: string;
  entries: StatusScalar[];
}): ArrayItem {
  const typeEntry = item.entries.find(
    (entry): entry is StatusStr => entry.type === 'str' && entry.key === 'type',
  );
  const progressEntry = item.entries.find(isProgressEntry) as
    | StatusNum
    | undefined;
  const pcEntry = !progressEntry
    ? item.entries.find(
        (e): e is StatusNum => e.type === 'num' && isExplicitPercentEntry(e),
      )
    : undefined;
  const excluded = new Set<StatusScalar>(
    [typeEntry, progressEntry ?? pcEntry].filter(Boolean) as StatusScalar[],
  );
  const metrics: ArrayMetric[] = item.entries
    .filter((entry) => !excluded.has(entry))
    .map((entry) => {
      const value = scalarValueStr(entry);
      const tooltip =
        entry.type === 'num' && entry.key === 'time' && entry.fraction
          ? `${entry.fraction.num}/${entry.fraction.den}`
          : undefined;
      return { key: entry.key, value, tooltip };
    });

  const activeProgress = progressEntry ?? pcEntry;
  if (activeProgress) {
    const percentage = getProgressPercentage(activeProgress);
    return {
      key: item.name,
      name: item.name,
      type: typeEntry?.value,
      metrics,
      progress: percentage ?? undefined,
    };
  }
  return { key: item.name, name: item.name, type: typeEntry?.value, metrics };
}

export function hasDoneFlag(entries: StatusEntry[]): boolean {
  return entries.some((e) => e.type === 'bool' && e.key === 'done');
}

export function buildFilterStatusViewModel(
  parsedStatus: ParsedFilterStatus,
): FilterStatusViewModel {
  const { entries } = parsedStatus;

  const infoEntry = entries.find(isInfoEntry);
  const progressEntry = entries.find(isProgressEntry);
  const bufferEntry = entries.find(isBufferEntry);
  const excludedEntries = new Set<StatusEntry>(
    [infoEntry, progressEntry, bufferEntry].filter(Boolean) as StatusEntry[],
  );

  const isDone = hasDoneFlag(entries);

  const numericMetrics = entries
    .filter(
      (entry): entry is StatusNum =>
        entry.type === 'num' &&
        !excludedEntries.has(entry) &&
        (Number.isFinite(entry.value) || Boolean(entry.fraction)),
    )
    .map((entry) => ({
      ...toNumericMetric(entry),
      ...(isDone && { completionSnapshot: true as const, graphable: false }),
    }));

  const textMetrics = entries.filter(isTextMetricEntry).map(
    (entry): TextMetric => ({
      key: entry.key,
      value: entry.value,
      quoted: entry.quoted,
    }),
  );

  const stateBadges = entries.filter(isStateBadgeEntry).map(toStateBadge);

  const arrayGroups = entries
    .filter((entry): entry is StatusArray => entry.type === 'array')
    .map(
      (array, index): ArrayGroup => ({
        key:
          array.items.length > 0
            ? array.items.map((item) => item.name).join(',')
            : `array-${index}`,
        label: '',
        items: array.items.map(toArrayItem),
      }),
    );

  return {
    info: infoEntry?.value,
    primaryProgress: progressEntry ? toProgressBar(progressEntry) : undefined,
    buffer: bufferEntry ? toBufferMetric(bufferEntry as StatusNum) : undefined,
    numericMetrics,
    textMetrics,
    stateBadges,
    arrays: arrayGroups,
    completionDone: isDone || undefined,
  };
}
