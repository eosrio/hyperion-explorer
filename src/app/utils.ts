export function getPrecision(asset: string): number {
  if (asset) {
    try {
      return asset.split(' ')[0].split('.')[1].length;
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
      return asset.split(' ')[1];
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
    return int + 'h ' + Math.round(remainder / calcMin) + 'min';
  }
  if (micros > calcMin) {
    int = Math.floor(micros / calcMin);
    remainder = micros % calcMin;
    return int + 'min ' + Math.round(remainder / calcSec) + 's';
  }
  if (micros > calcSec) {
    return (micros / calcSec).toFixed(2) + 's';
  }
  if (micros > 1000) {
    return (micros / (1000)).toFixed(2) + 'ms';
  }
  return micros + 'µs';
}
