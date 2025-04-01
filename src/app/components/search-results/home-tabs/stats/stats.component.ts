import { Component } from '@angular/core';
import {faClock, faCube, faLink, faServer} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";

@Component({
  selector: 'app-stats',
  imports: [
    FaIconComponent
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent {

  icons = {
    solid: {
      cube: faCube,
      link: faLink,
      clock: faClock,
      server: faServer,
    }
  };

}
