import { ChainTimePipe, TimePreference } from "../../../../chain-time";
import { FinalityHelpComponent } from "../../../finality-help/finality-help.component";
import { describeApiError, isRetryableApiError } from "../../../../api-errors";
import { CopyIdentifierComponent } from "../../../copy-identifier/copy-identifier.component";
import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { faClock, faCube, faLink, faServer, faSync } from "@fortawesome/free-solid-svg-icons";
import { ChainService } from "../../../../services/chain.service";
import { MatTooltipModule } from "@angular/material/tooltip";

@Component({
  selector: "app-stats",
  imports: [ChainTimePipe, FinalityHelpComponent, CopyIdentifierComponent, MatTooltipModule],
  templateUrl: "./stats.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./stats.component.css"
})
export class StatsComponent {
  chainService = inject(ChainService);
  readonly time = inject(TimePreference);
  readonly describeApiError = describeApiError;
  readonly isRetryableApiError = isRetryableApiError;

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
