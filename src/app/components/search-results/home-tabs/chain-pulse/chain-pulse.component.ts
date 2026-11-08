import { MorphLinkDirective } from "../../../../morph";
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ChainService } from "../../../../services/chain.service";

/**
 * The chain's heartbeat on arrival: head block, last irreversible block and the producing account, kept current
 * while the home page is open. Values update silently (no live-region churn); only a lost connection is announced.
 */
@Component({
  selector: "app-chain-pulse",
  imports: [MorphLinkDirective, DatePipe, DecimalPipe, RouterLink],
  templateUrl: "./chain-pulse.component.html",
  styleUrl: "./chain-pulse.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChainPulseComponent {
  readonly chain = inject(ChainService);

  readonly info = this.chain.chainInfo;
  readonly head = computed(() => this.info()?.head_block_num ?? 0);
  readonly lib = this.chain.lastIrreversibleBlockNum;
  readonly lag = computed(() => Math.max(0, this.head() - this.lib()));
  readonly producer = computed(() => this.info()?.head_block_producer ?? "");
  /** The new head drives one heartbeat trace; a list keyed by block number replays it on every change. */
  readonly beat = computed(() => [this.head()]);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.chain.startLiveHead()));
  }
}
