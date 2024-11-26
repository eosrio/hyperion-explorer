import {Component, computed, input, model} from '@angular/core';
import {RouterLink} from "@angular/router";
import {MatTooltip} from "@angular/material/tooltip";
import {faChevronRight, faClock, faKey, faUser} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {Permission} from "../../../interfaces";
import {MatIconButton} from "@angular/material/button";
import {NgClass} from "@angular/common";
import {state, style, transition, trigger, animate} from "@angular/animations";

@Component({
  selector: 'app-permission-node',
  imports: [
    RouterLink,
    MatTooltip,
    FaIconComponent,
    MatIconButton,
    NgClass
  ],
  templateUrl: './permission-node.component.html',
  styleUrl: './permission-node.component.css',
  animations: [
    trigger('reveal', [
      transition(':enter', [
        style({opacity: 0, transform: 'translateY(-100%)'}),
        animate('100ms', style({opacity: 1, transform: 'translateY(0%)'}))
      ]),
      transition(':leave', [
        animate(100, style({opacity: 0, transform: 'translateY(100%)'}))
      ]),
    ])
  ],
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
    }
  }

  toggleExpansion() {
    this.expanded.set(!this.expanded());
  }
}
