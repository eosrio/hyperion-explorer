import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, linkedSignal } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

@Component({
  selector: "app-copy-identifier",
  imports: [CdkCopyToClipboard, MatIcon, MatTooltip],
  templateUrl: "./copy-identifier.component.html",
  styleUrl: "./copy-identifier.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CopyIdentifierComponent {
  readonly value = input.required<string>();
  readonly label = input("identifier");
  readonly copied = linkedSignal<boolean | null>(() => {
    this.value();
    return null;
  });
  private resetTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.resetTimer));
  }
  copyFinished(success: boolean): void {
    clearTimeout(this.resetTimer);
    this.copied.set(success);
    if (success) {
      const value = this.value();
      this.resetTimer = setTimeout(() => {
        if (this.value() === value) this.copied.set(null);
      }, 3000);
    }
  }
}
