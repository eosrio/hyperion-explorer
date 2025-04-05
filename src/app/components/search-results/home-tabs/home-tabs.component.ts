import { Component } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations'; // Import animation functions
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from "@angular/material/tabs";
import { StatsComponent } from "./stats/stats.component";
import { ProducersComponent } from "./producers/producers.component";
import { PriceHistoryComponent } from "./price-history/price-history.component";
import { MatButtonModule } from "@angular/material/button"; // For MatIconButton
import { MatIconModule } from "@angular/material/icon";
import { MatRippleModule } from '@angular/material/core'; // Import MatRippleModule for ripple effect
import { CommonModule } from "@angular/common";

@Component({
  selector: 'app-home-tabs',
  standalone: true, // Ensure component is standalone
  imports: [
    CommonModule,
    MatTabGroup,
    MatTab,
    MatTabLabel,
    MatTabContent,
    StatsComponent,
    ProducersComponent,
    PriceHistoryComponent,
    MatButtonModule, // Keep MatButtonModule (provides MatIconButton)
    MatIconModule,
    MatRippleModule // Add MatRippleModule
  ],
  templateUrl: './home-tabs.component.html',
  styleUrl: './home-tabs.component.css',
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0px',
        minHeight: '0', // Ensure min-height doesn't interfere
        opacity: 0,
        overflow: 'hidden',
        // Ensure padding/margin don't add height when collapsed
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('expanded', style({
        height: '*', // Let content determine height
        opacity: 1,
        overflow: 'visible' // Allow content overflow (like dropdowns) when fully expanded
      })),
      // Use standard cubic-bezier for both transitions
      transition('collapsed <=> expanded', [
        style({ overflow: 'hidden' }), // Keep hidden during animation
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ]),
    ])
  ]
})
export class HomeTabsComponent {
  isExpanded = false; // State variable for expansion

  toggleExpansion(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isExpanded = !this.isExpanded;
  }
}
