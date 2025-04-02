import { Component } from '@angular/core';
import {MatTab, MatTabContent, MatTabGroup, MatTabLabel} from "@angular/material/tabs";
import {StatsComponent} from "./stats/stats.component";
import {ProducersComponent} from "./producers/producers.component";

@Component({
  selector: 'app-home-tabs',
  imports: [
    MatTabGroup,
    MatTab,
    MatTabLabel,
    MatTabContent,
    StatsComponent,
    ProducersComponent
  ],
  templateUrl: './home-tabs.component.html',
  styleUrl: './home-tabs.component.css'
})
export class HomeTabsComponent {

}
