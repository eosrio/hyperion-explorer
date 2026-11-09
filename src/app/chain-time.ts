import { inject, Injectable, Pipe, PipeTransform, PLATFORM_ID, signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { asUtcTimestamp } from "./utils";

const STORAGE_KEY = "explorer-time-zone";

/**
 * One time-zone preference for the whole explorer: local time by default, UTC on request. Chain timestamps arrive
 * in UTC without a zone suffix; every rendered time names its zone so a reader never has to guess.
 */
@Injectable({ providedIn: "root" })
export class TimePreference {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly utc = signal(this.read());

  setUtc(utc: boolean): void {
    this.utc.set(utc);
    if (!this.browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, utc ? "utc" : "local");
    } catch {
      // Storage can be unavailable (private windows); the choice still applies for this visit.
    }
  }

  private read(): boolean {
    if (!this.browser) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "utc";
    } catch {
      return false;
    }
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(utc: boolean, timeOnly: boolean): Intl.DateTimeFormat {
  const key = `${utc}:${timeOnly}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      ...(timeOnly ? {} : { year: "numeric", month: "short", day: "numeric" }),
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: utc ? "UTC" : undefined,
      timeZoneName: "short"
    });
    formatters.set(key, format);
  }
  return format;
}

/** "Oct 23, 2026, 09:39:49 UTC" or "Oct 23, 2026, 06:39:49 GMT-3"; chain strings without a zone are read as UTC. */
export function formatChainTime(value: string | number | Date | null | undefined, utc: boolean, timeOnly = false): string {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(typeof value === "string" ? asUtcTimestamp(value) : value);
  return Number.isNaN(date.getTime()) ? String(value) : formatter(utc, timeOnly).format(date);
}

/** Machine-readable form for `<time datetime>`. */
export function isoChainTime(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(typeof value === "string" ? asUtcTimestamp(value) : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * How long ago a chain timestamp was, for activity within the last day ("just now", "12 min ago", "3 h ago");
 * null for anything older, which the full timestamp beside it already says plainly.
 */
export function ageOfChainTime(value: string | null | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const time = new Date(asUtcTimestamp(value)).getTime();
  if (Number.isNaN(time)) return null;
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 0 || minutes >= 24 * 60) return null;
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

@Pipe({ name: "chainTime" })
export class ChainTimePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, utc: boolean, mode: "full" | "time" = "full"): string {
    return formatChainTime(value, utc, mode === "time");
  }
}
