import { Component, inject } from '@angular/core'; // Import inject
import { faClock, faCube, faLink, faServer } from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { ChainService } from "../../../../services/chain.service"; // Import ChainService
import { CommonModule } from "@angular/common"; // Import CommonModule for pipes

@Component({
  selector: 'app-stats',
  standalone: true, // Make component standalone
  imports: [
    CommonModule, // Add CommonModule for pipes (number, date)
    FaIconComponent
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent {
  chainService = inject(ChainService); // Inject ChainService

  icons = {
    solid: {
      cube: faCube,
      link: faLink,
      clock: faClock,
      server: faServer,
    }
  };

}
