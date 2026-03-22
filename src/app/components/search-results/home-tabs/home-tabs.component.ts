import {Component, inject, signal} from '@angular/core';
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from "@angular/material/tabs";
import { StatsComponent } from "./stats/stats.component";
import { ProducersComponent } from "./producers/producers.component";
import { PriceHistoryComponent } from "./price-history/price-history.component";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatRippleModule } from '@angular/material/core';
import {DataService} from "../../../services/data.service";
import {NgClass} from "@angular/common";

@Component({
  selector: 'app-home-tabs',
  imports: [
    NgClass,
    MatTabGroup,
    MatTab,
    MatTabLabel,
    MatTabContent,
    StatsComponent,
    ProducersComponent,
    PriceHistoryComponent,
    MatButtonModule,
    MatIconModule,
    MatRippleModule
  ],
  templateUrl: './home-tabs.component.html',
  styleUrl: './home-tabs.component.css'
})
export class HomeTabsComponent {

  ds = inject(DataService);

  isExpanded = signal(false);

  toggleExpansion(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isExpanded.update(v => !v);
  }
}
