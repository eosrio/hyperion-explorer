import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { DecimalPipe, PercentPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ACTIVITY_SAMPLE, ChainAnalyticsService, DayStats } from "../../../../services/chain-analytics.service";
import { ChainService } from "../../../../services/chain.service";

/**
 * What the chain has been doing, from Hyperion's own aggregates: the last 24 hours, the producer rotation, what the
 * recent actions are, and how complete the index is. A panel appears only once its data does, and never on an
 * API that cannot serve it. Polling is owned by the pulse above, which starts the shared analytics service.
 */
@Component({
  selector: "app-chain-analytics",
  imports: [DecimalPipe, PercentPipe, RouterLink],
  templateUrl: "./chain-analytics.component.html",
  styleUrl: "./chain-analytics.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChainAnalyticsComponent {
  private readonly analytics = inject(ChainAnalyticsService);
  private readonly chain = inject(ChainService);

  readonly day = this.analytics.day;
  readonly rotation = this.analytics.rotation;
  readonly activity = this.analytics.activity;
  readonly health = this.analytics.health;
  readonly sampleSize = ACTIVITY_SAMPLE;
  readonly settled = this.analytics.settled;
  /** Placeholder shapes: the real panels' tile labels, hour count, a typical producer set and activity rows. */
  readonly dayLabels = ["Transactions", "Actions", "Active accounts", "New accounts"];
  readonly placeholderHours = Array.from({ length: 24 });
  readonly placeholderProducers = Array.from({ length: 20 });
  readonly placeholderActivity = Array.from({ length: 5 });
  readonly producingNow = computed(() => this.chain.chainInfo()?.head_block_producer ?? "");

  /** Complete hours only: the hour in progress is drawn but would drag the range and scale down. */
  private completeHours(day: DayStats): number[] {
    return day.hourly.slice(0, -1);
  }

  hourScale = computed(() => {
    const day = this.day();
    return day ? Math.max(1, ...this.completeHours(day), day.hourly.at(-1) ?? 0) : 1;
  });

  hourHeight(value: number): number {
    return Math.max(3, (100 * value) / this.hourScale());
  }

  hourRange(day: DayStats): { low: number; high: number } | null {
    const hours = this.completeHours(day);
    return hours.length ? { low: Math.min(...hours), high: Math.max(...hours) } : null;
  }

  hourlyLabel(day: DayStats): string {
    const range = this.hourRange(day);
    if (!range) return "Transactions per hour over the last 24 hours.";
    return `Transactions per hour over the last 24 hours: between ${range.low.toLocaleString("en-US")} and ${range.high.toLocaleString("en-US")} in each complete hour.`;
  }

  blockRange(): { low: number; high: number } | null {
    const producers = this.rotation()?.producers ?? [];
    if (!producers.length) return null;
    const blocks = producers.map(producer => producer.blocks);
    return { low: Math.min(...blocks), high: Math.max(...blocks) };
  }
}
