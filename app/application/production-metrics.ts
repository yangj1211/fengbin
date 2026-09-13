// Keep exact threshold boundaries stable when decimal quantities are represented as floats.
export function belowProductionThreshold(value: number, threshold: number) {
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(threshold)) * 4;
  return value < threshold - tolerance;
}
