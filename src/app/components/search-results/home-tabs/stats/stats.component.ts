import { FinalityHelpComponent } from "../../../finality-help/finality-help.component";
import { describeApiError } from "../../../../api-errors";
import { CopyIdentifierComponent } from "../../../copy-identifier/copy-identifier.component";
import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { faClock, faCube, faLink, faServer, faSync } from "@fortawesome/free-solid-svg-icons";
import { ChainService } from "../../../../services/chain.service";
import { DecimalPipe, DatePipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";

@Component({
  selector: "app-stats",
  imports: [FinalityHelpComponent, CopyIdentifierComponent, DecimalPipe, DatePipe, RouterLink, MatButtonModule, MatTooltipModule],
  templateUrl: "./stats.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./stats.component.css"
})
export class StatsComponent {
  chainService = inject(ChainService);
  readonly describeApiError = describeApiError;

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
