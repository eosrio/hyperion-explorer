import { Component, DestroyRef, inject, input, signal, ChangeDetectionStrategy } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { RouterLink } from "@angular/router";
import { MatTooltip } from "@angular/material/tooltip";
import { faCheck, faClock, faKey, faUser } from "@fortawesome/free-solid-svg-icons";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { Permission } from "../../../interfaces";

@Component({
  selector: "app-permission-node",
  imports: [RouterLink, MatTooltip, FaIconComponent, CdkCopyToClipboard],
  templateUrl: "./permission-node.component.html",
  styleUrl: "./permission-node.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionNodeComponent {
  node = input.required<Permission>();
  level = input.required<number>();

  icons = {
    solid: {
      faKey: faKey,
      faUser: faUser,
      faClock: faClock,
      faCheck: faCheck
    },
    regular: { faCopy }
  };

  /** Key most recently copied; cleared after a short confirmation window. */
  readonly copiedKey = signal<string | null>(null);
  private copyTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copyTimer));
  }
  copied(key: string | null): void {
    clearTimeout(this.copyTimer);
    this.copiedKey.set(key);
    if (key) this.copyTimer = setTimeout(() => this.copiedKey.set(null), 2000);
  }
}
