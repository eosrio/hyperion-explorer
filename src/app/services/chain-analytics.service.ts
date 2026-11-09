import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { inject, Injectable, PLATFORM_ID, signal } from "@angular/core";
import { lastValueFrom } from "rxjs";
import { DataService } from "./data.service";
import { ChainService } from "./chain.service";

/** One block in the live ribbon: how many transactions it carried and who produced it. */
export interface RibbonBlock {
  num: number;
  trx: number;
  producer: string;
}

export interface DayStats {
  /** Real transactions, without the automatic onblock every block carries; null when this API cannot count them. */
  transactions: number | null;
  /** Transactions as the usage counter reports them (onblock included); the fallback when the above is null. */
  transactionsWithOnblock: number | null;
  actions: number | null;
  activeAccounts: number | null;
  /** Hour buckets, oldest first; the last one is the hour in progress. Empty when this API cannot group by hour. */
  hourly: number[];
  newAccounts: number | null;
  /** Accounts created since genesis; capped means the search counter stopped at its limit. */
  accountsTotal: { value: number; capped: boolean } | null;
}

export interface Rotation {
  /** Blocks each producer made in the last hour, in schedule order as the API returns it. */
  producers: { name: string; blocks: number }[];
  missedBlocks24h: number | null;
}

export interface ActivityShare {
  contract: string;
  action: string;
  share: number;
}

export interface IndexHealth {
  version: string;
  indexedBlocks: number | null;
  missingBlocks: number | null;
  missingPct: string | null;
}

const RIBBON_MS = 5_000;
const DAY_MS = 60_000;
const HEALTH_MS = 300_000;
const RIBBON_SIZE = 60;
/** 50 keeps the sample under half a second; 200 took about 3 s on Wire. */
export const ACTIVITY_SAMPLE = 50;

/** An "after" bound for Hyperion queries; whole hours line hourly buckets up, exact windows mean "the last N hours". */
function isoHoursAgo(hours: number, wholeHour = true): string {
  const at = new Date(Date.now() - hours * 3_600_000);
  if (wholeHour) at.setUTCMinutes(0, 0, 0);
  return at.toISOString().slice(0, 19);
}

/**
 * Home-page analytics from Hyperion's own aggregates. Each panel loads and fails on its own: an API that lacks an
 * endpoint (older Hyperion releases have no get_trx_count) simply leaves that panel empty, and the page hides it.
 * Everything polls only in the browser, only while some view uses it, and pauses while the tab is hidden.
 */
@Injectable({ providedIn: "root" })
export class ChainAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly data = inject(DataService);
  private readonly chain = inject(ChainService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly ribbon = signal<RibbonBlock[] | null>(null);
  readonly day = signal<DayStats | null>(null);
  readonly rotation = signal<Rotation | null>(null);
  readonly activity = signal<ActivityShare[] | null>(null);
  readonly health = signal<IndexHealth | null>(null);

  private users = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Bumped on every fresh start, so loops from a stopped session never run alongside the new ones. */
  private generation = 0;

  /** Start polling for a view; the returned function stops it (polling ends when the last view stops). */
  start(): () => void {
    if (!this.browser) return () => undefined;
    this.users++;
    if (this.users === 1) {
      this.generation++;
      this.loop(() => this.loadRibbon(), RIBBON_MS);
      this.loop(() => Promise.all([this.loadDay(), this.loadRotation(), this.loadActivity()]), DAY_MS);
      this.loop(() => this.loadHealth(), HEALTH_MS);
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.users--;
      if (this.users === 0) {
        this.timers.forEach(clearTimeout);
        this.timers = [];
      }
    };
  }

  private loop(task: () => Promise<unknown>, every: number): void {
    const slot = this.timers.length;
    const generation = this.generation;
    const live = () => this.users > 0 && generation === this.generation;
    const run = async () => {
      if (!live()) return;
      if (document.visibilityState !== "hidden") await task().catch(() => undefined);
      if (live()) this.timers[slot] = setTimeout(run, every);
    };
    this.timers.push(setTimeout(run, 0));
  }

  private get api(): string {
    return this.data.env.hyperionApiUrl;
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      return await lastValueFrom(this.http.get<T>(this.api + path));
    } catch {
      return null;
    }
  }

  private async loadRibbon(): Promise<void> {
    const res = await this.get<{ blocks?: { block_num: number; trx_count?: number; producer: string }[] }>(
      `/v2/history/get_blocks?limit=${RIBBON_SIZE}&sort=desc`
    );
    if (!res?.blocks?.length) return;
    this.ribbon.set(
      res.blocks
        .map(block => ({ num: block.block_num, trx: Number(block.trx_count) || 0, producer: block.producer }))
        .sort((a, b) => a.num - b.num)
    );
  }

  private async loadDay(): Promise<void> {
    const system = this.chain.systemContract();
    const [hourly, usage, newAccounts, accountsTotal] = await Promise.all([
      this.get<{ total_trx_count?: number; grouped_stats?: Record<string, { trx_count: number }> }>(
        `/v2/stats/get_trx_count?after=${isoHoursAgo(23)}&group_by=hour`
      ),
      this.get<{ action_count?: string | number; tx_count?: number; unique_actors?: number }>(
        "/v2/stats/get_action_usage?period=24h&unique_actors=true"
      ),
      this.get<{ total?: { value: number } }>(
        `/v2/history/get_actions?limit=1&act.account=${system}&act.name=newaccount&after=${isoHoursAgo(24, false)}`
      ),
      this.get<{ total?: { value: number; relation?: string } }>(`/v2/history/get_actions?limit=1&act.account=${system}&act.name=newaccount`)
    ]);
    const buckets = hourly?.grouped_stats
      ? Object.entries(hourly.grouped_stats)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, bucket]) => Number(bucket.trx_count) || 0)
          .slice(-24)
      : [];
    const stats: DayStats = {
      transactions: buckets.length ? buckets.reduce((sum, value) => sum + value, 0) : null,
      transactionsWithOnblock: typeof usage?.tx_count === "number" ? usage.tx_count : null,
      actions: usage?.action_count !== undefined ? Number(usage.action_count) : null,
      activeAccounts: typeof usage?.unique_actors === "number" ? usage.unique_actors : null,
      hourly: buckets,
      newAccounts: newAccounts?.total ? newAccounts.total.value : null,
      accountsTotal: accountsTotal?.total ? { value: accountsTotal.total.value, capped: accountsTotal.total.relation === "gte" } : null
    };
    const empty = stats.transactions === null && stats.transactionsWithOnblock === null && stats.actions === null;
    this.day.set(empty ? null : stats);
  }

  private async loadRotation(): Promise<void> {
    const [byProducer, missed] = await Promise.all([
      this.get<{ grouped_stats?: Record<string, { block_count: number }> }>(`/v2/stats/get_trx_count?after=${isoHoursAgo(1, false)}&group_by=producer`),
      this.get<{ events?: unknown[] }>(`/v2/stats/get_missed_blocks?after=${isoHoursAgo(24, false)}`)
    ]);
    if (!byProducer?.grouped_stats) {
      this.rotation.set(null);
      return;
    }
    const producers = Object.entries(byProducer.grouped_stats)
      .map(([name, stats]) => ({ name, blocks: Number(stats.block_count) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.rotation.set({ producers, missedBlocks24h: Array.isArray(missed?.events) ? missed.events.length : null });
  }

  private async loadActivity(): Promise<void> {
    const res = await this.get<{ actions?: { act?: { account?: string; name?: string } }[] }>(
      `/v2/history/get_actions?limit=${ACTIVITY_SAMPLE}&sort=desc&act.name=!onblock`
    );
    const actions = res?.actions ?? [];
    if (!actions.length) {
      this.activity.set(null);
      return;
    }
    const counts = new Map<string, number>();
    for (const action of actions) {
      const key = `${action.act?.account ?? "?"}::${action.act?.name ?? "?"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    this.activity.set(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, count]) => {
          const [contract, action] = key.split("::");
          return { contract, action, share: count / actions.length };
        })
    );
  }

  private async loadHealth(): Promise<void> {
    const res = await this.get<{
      version?: string;
      health?: { service: string; service_data?: Record<string, unknown> | null }[];
    }>("/v2/health");
    if (!res) return;
    const es = res.health?.find(entry => entry.service === "Elasticsearch")?.service_data ?? {};
    const num = (value: unknown) => (typeof value === "number" ? value : null);
    this.health.set({
      version: res.version ?? "",
      indexedBlocks: num(es["total_indexed_blocks"]),
      missingBlocks: num(es["missing_blocks"]),
      missingPct: typeof es["missing_pct"] === "string" ? (es["missing_pct"] as string) : null
    });
  }
}
