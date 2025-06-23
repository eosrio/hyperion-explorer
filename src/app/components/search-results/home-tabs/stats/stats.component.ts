import { Component, inject } from '@angular/core'; // Import inject
import {faClock, faCube, faLink, faServer, faSync} from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { ChainService } from "../../../../services/chain.service"; // Import ChainService
import { CommonModule } from "@angular/common";
import {RouterLink} from "@angular/router";
import {MatButtonModule} from "@angular/material/button"; // Import for mat-raised-button
import {MatTooltipModule} from "@angular/material/tooltip"; // Import for matTooltip

@Component({
  selector: 'app-stats',
  standalone: true, // Make component standalone
  imports: [
    CommonModule, // Add CommonModule for pipes (number, date)
    FaIconComponent,
    RouterLink,
    MatButtonModule, // Add MatButtonModule for mat-raised-button
    MatTooltipModule // Add MatTooltipModule for matTooltip directive
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
