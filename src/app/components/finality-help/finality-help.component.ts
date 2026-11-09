import { ChangeDetectionStrategy, Component } from "@angular/core";
export const FINALITY_HELP =
  "An irreversible block has been finalized by this chain. Pending activity can change until its block is at or below the last irreversible block (LIB). A disconnected stream does not mean the chain has stopped.";

@Component({
  selector: "app-finality-help",
  templateUrl: "./finality-help.component.html",
  styleUrl: "./finality-help.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinalityHelpComponent {
  readonly text = FINALITY_HELP;
}
