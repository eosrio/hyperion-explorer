import { Component, computed, DestroyRef, inject, input, model, signal, ChangeDetectionStrategy } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { RouterLink } from "@angular/router";
import { MatTooltip } from "@angular/material/tooltip";
import { faCheck, faChevronRight, faClock, faKey, faUser } from "@fortawesome/free-solid-svg-icons";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { Permission } from "../../../interfaces";
import { MatIconButton } from "@angular/material/button";
import { NgClass } from "@angular/common";

@Component({
  selector: "app-permission-node",
  imports: [RouterLink, MatTooltip, FaIconComponent, MatIconButton, NgClass, CdkCopyToClipboard],
  templateUrl: "./permission-node.component.html",
  styleUrl: "./permission-node.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionNodeComponent {
  node = input.required<Permission>();
  children = computed(() => this.node().children || []);
  level = input.required<number>();
  expanded = model<boolean>();

  icons = {
    solid: {
      faChevronRight: faChevronRight,
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

  toggleExpansion() {
    this.expanded.set(!this.expanded());
  }
}
