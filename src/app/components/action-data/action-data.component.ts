import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowRight, faCheck } from "@fortawesome/free-solid-svg-icons";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { ActDataViewComponent } from "../act-data-view/act-data-view.component";
import { describeAction } from "../../action-grammar";
import { ChainService } from "../../services/chain.service";
import { MorphLinkDirective } from "../../morph";

/** Data with more values than this (nested values included) starts clipped, with a control to show everything. */
const LARGE_DATA_FIELDS = 12;
/** Data Hyperion could not decode arrives as one hex string; anything this long is clipped to a few lines. */
const HEX_DATA = /^(?:[0-9a-f]{2})+$/i;

/**
 * One action's data, read the way a person would say it. Well-known actions render as grammar lines with their
 * raw fields one click away; everything else keeps the aligned key/value view.
 */
@Component({
  selector: "app-action-data",
  imports: [RouterLink, CdkCopyToClipboard, FaIconComponent, ActDataViewComponent, MorphLinkDirective],
  templateUrl: "./action-data.component.html",
  styleUrl: "./action-data.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionDataComponent {
  private readonly chain = inject(ChainService);

  readonly contract = input<string>("");
  readonly name = input<string>("");
  readonly data = input<unknown>(null);

  readonly icons = { arrow: faArrowRight, copy: faCopy, copied: faCheck };
  readonly lines = computed(() => describeAction(this.contract(), this.name(), this.data(), this.chain.systemContract()));
  readonly hex = computed(() => {
    const data = this.data();
    return typeof data === "string" && data.length >= 16 && HEX_DATA.test(data) ? data : null;
  });
  /** Counts every value, nested ones included, so one large payload (an onblock header) cannot fill the screen. */
  readonly large = computed(() => {
    const data = this.data();
    if (!data || typeof data !== "object") return false;
    let size = 0;
    const stack: unknown[] = [data];
    while (stack.length > 0 && size <= LARGE_DATA_FIELDS) {
      const value = stack.pop();
      size++;
      if (value && typeof value === "object") stack.push(...Object.values(value));
    }
    return size > LARGE_DATA_FIELDS;
  });

  readonly showRaw = signal(false);
  readonly expanded = signal(false);
  /** The hash value most recently copied, for a short check-mark confirmation. */
  readonly copied = signal<string | null>(null);
  private copiedTimer?: ReturnType<typeof setTimeout>;

  /** Keys keep their prefix and last characters ("PUB_K1_6PH7…26usBU"); the full value stays in the link. */
  shortKey(key: string): string {
    return key.length > 24 ? `${key.slice(0, 11)}…${key.slice(-6)}` : key;
  }

  shortHash(value: string): string {
    return value.length > 28 ? `${value.slice(0, 14)}…${value.slice(-8)}` : value;
  }

  markCopied(value: string, success: boolean): void {
    clearTimeout(this.copiedTimer);
    this.copied.set(success ? value : null);
    if (success) this.copiedTimer = setTimeout(() => this.copied.set(null), 2000);
  }
}
