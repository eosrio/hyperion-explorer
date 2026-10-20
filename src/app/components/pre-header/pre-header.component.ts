import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { DataService } from "../../services/data.service";

@Component({
  selector: "app-pre-header",
  imports: [],
  templateUrl: "./pre-header.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./pre-header.component.css"
})
export class PreHeaderComponent {
  private data = inject(DataService);

  chainData = this.data.explorerMetadata;
}
