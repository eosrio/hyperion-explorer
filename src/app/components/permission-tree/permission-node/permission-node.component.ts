import { Component, computed, input, model, ChangeDetectionStrategy } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatTooltip } from "@angular/material/tooltip";
import { faChevronRight, faClock, faKey, faUser } from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { Permission } from "../../../interfaces";
import { MatIconButton } from "@angular/material/button";
import { NgClass } from "@angular/common";

@Component({
  selector: "app-permission-node",
  imports: [RouterLink, MatTooltip, FaIconComponent, MatIconButton, NgClass],
  templateUrl: "./permission-node.component.html",
  styleUrl: "./permission-node.component.css",
  changeDetection: ChangeDetectionStrategy.Eager
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
      faClock: faClock
    }
  };

  toggleExpansion() {
    this.expanded.set(!this.expanded());
  }
}
