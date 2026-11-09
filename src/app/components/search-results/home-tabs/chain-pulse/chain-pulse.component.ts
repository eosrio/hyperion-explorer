import { ChainTimePipe, TimePreference } from "../../../../chain-time";
import { MorphLinkDirective } from "../../../../morph";
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ChainService } from "../../../../services/chain.service";
import { ChainAnalyticsService } from "../../../../services/chain-analytics.service";

/**
 * The chain's heartbeat on arrival: head block, last irreversible block and the producing account, kept current
 * while the home page is open. Values update silently (no live-region churn); only a lost connection is announced.
 */
@Component({
  selector: "app-chain-pulse",
  imports: [ChainTimePipe, MorphLinkDirective, DecimalPipe, RouterLink],
  templateUrl: "./chain-pulse.component.html",
  styleUrl: "./chain-pulse.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChainPulseComponent {
  readonly chain = inject(ChainService);
  readonly time = inject(TimePreference);

  readonly info = this.chain.chainInfo;
  readonly head = computed(() => this.info()?.head_block_num ?? 0);
  readonly lib = this.chain.lastIrreversibleBlockNum;
  readonly lag = computed(() => Math.max(0, this.head() - this.lib()));
  readonly producer = computed(() => this.info()?.head_block_producer ?? "");
  /** The new head drives one heartbeat trace; a list keyed by block number replays it on every change. */
  readonly beat = computed(() => [this.head()]);

  private readonly analytics = inject(ChainAnalyticsService);
  readonly ribbon = this.analytics.ribbon;
  readonly ribbonSettled = computed(() => this.analytics.settled().ribbon);
  readonly ribbonStubs = Array.from({ length: 60 });
  readonly ribbonTotal = computed(() => (this.ribbon() ?? []).reduce((sum, block) => sum + block.trx, 0));
  private readonly ribbonMax = computed(() => Math.max(1, ...(this.ribbon() ?? []).map(block => block.trx)));
  readonly ribbonLabel = computed(() => {
    const blocks = this.ribbon() ?? [];
    const busy = blocks.filter(block => block.trx > 0).length;
    return `Last ${blocks.length} blocks: ${this.ribbonTotal()} transactions, ${busy} of the blocks carried any.`;
  });
  /** Empty blocks keep a short stub so the strip reads as a run of blocks, not gaps. */
  barHeight(trx: number): number {
    return trx === 0 ? 12 : 30 + (70 * trx) / this.ribbonMax();
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      destroyRef.onDestroy(this.chain.startLiveHead());
      destroyRef.onDestroy(this.analytics.start());
    });
  }
}
