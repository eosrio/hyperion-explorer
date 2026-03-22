import { Component, inject } from '@angular/core';
import {faClock, faCube, faLink, faServer, faSync} from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { ChainService } from "../../../../services/chain.service";
import { DecimalPipe, DatePipe } from "@angular/common";
import {RouterLink} from "@angular/router";
import {MatButtonModule} from "@angular/material/button";
import {MatTooltipModule} from "@angular/material/tooltip";

@Component({
  selector: 'app-stats',
  imports: [
    DecimalPipe,
    DatePipe,
    FaIconComponent,
    RouterLink,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent {
  chainService = inject(ChainService);



  icons = {
    solid: {
      cube: faCube,
      link: faLink,
      clock: faClock,
      server: faServer,
      sync: faSync
    }
  };

}
