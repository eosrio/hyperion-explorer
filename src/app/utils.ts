export function getPrecision(asset: string): number {
  if (asset) {
    try {
      return asset.split(" ")[0].split(".")[1].length;
    } catch (e) {
      return 4;
    }
  } else {
    return 4;
  }
}

export function getSymbol(asset: string): string | null {
  if (asset) {
    try {
      return asset.split(" ")[1];
    } catch (e) {
      return null;
    }
  } else {
    return null;
  }
}

export function convertMicroS(micros: number): string {
  let int = 0;
  let remainder = 0;
  const calcSec = 1000 ** 2;
  const calcMin = calcSec * 60;
  const calcHour = calcMin * 60;
  if (micros > calcHour) {
    int = Math.floor(micros / calcHour);
    remainder = micros % calcHour;
    return int + "h " + Math.round(remainder / calcMin) + "min";
  }
  if (micros > calcMin) {
    int = Math.floor(micros / calcMin);
    remainder = micros % calcMin;
    return int + "min " + Math.round(remainder / calcSec) + "s";
  }
  if (micros > calcSec) {
    return (micros / calcSec).toFixed(2) + "s";
  }
  if (micros > 1000) {
    return (micros / 1000).toFixed(2) + "ms";
  }
  return micros + "µs";
}

/** NET and RAM are byte quantities; CPU is reported separately in microseconds. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  const index = Math.min(3, Math.floor(Math.log2(Math.max(1, bytes)) / 10));
  const amount = bytes / 1024 ** index;
  return amount.toLocaleString("en-US", { maximumFractionDigits: index ? 2 : 0 }) + " " + ["B", "KiB", "MiB", "GiB"][index];
}

export function asUtcTimestamp(value: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "Z";
}
