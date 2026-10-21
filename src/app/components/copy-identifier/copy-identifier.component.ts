import { ChangeDetectionStrategy, Component, effect, input, signal } from "@angular/core";
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
  readonly copied = signal<boolean | null>(null);
  constructor() {
    effect(() => {
      this.value();
      this.copied.set(null);
    });
  }
}
