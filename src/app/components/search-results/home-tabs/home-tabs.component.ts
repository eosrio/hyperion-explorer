import { Component } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations'; // Import animation functions
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from "@angular/material/tabs";
import { StatsComponent } from "./stats/stats.component";
import { ProducersComponent } from "./producers/producers.component";
import { PriceHistoryComponent } from "./price-history/price-history.component";
import { MatButtonModule } from "@angular/material/button"; // Import MatButtonModule
import { MatIconModule } from "@angular/material/icon"; // Import MatIconModule
import { CommonModule } from "@angular/common"; // Import CommonModule for *ngIf

@Component({
  selector: 'app-home-tabs',
  standalone: true, // Ensure component is standalone
  imports: [
    CommonModule, // Add CommonModule here
    MatTabGroup,
    MatTab,
    MatTabLabel,
    MatTabContent,
    StatsComponent,
    ProducersComponent,
    PriceHistoryComponent,
    MatButtonModule, // Add MatButtonModule here
    MatIconModule // Add MatIconModule here
  ],
  templateUrl: './home-tabs.component.html',
  styleUrl: './home-tabs.component.css',
  animations: [ // Add animations array
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0px',
        minHeight: '0',
        opacity: 0,
        overflow: 'hidden',
        // Adjust padding/margin if needed for smooth collapse
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('expanded', style({
        height: '*', // Auto height
        opacity: 1,
        overflow: 'visible' // Allow content to be visible
        // Reset padding/margin if adjusted in collapsed state
      })),
      transition('expanded <=> collapsed', [
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)') // Smooth animation timing
      ]),
    ])
  ]
})
export class HomeTabsComponent {
  isExpanded = false; // State variable for expansion

  toggleExpansion(): void {
    this.isExpanded = !this.isExpanded;
  }
}
