import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { DataService } from "../../services/data.service";
import { Router } from "@angular/router";

@Component({
  selector: "app-error",
  templateUrl: "./error.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./error.component.css"
})
export class ErrorComponent {
  retry(): void {
    window.location.reload();
  }
  ds = inject(DataService);
  router = inject(Router);

  constructor() {
    if (!this.ds.initError) {
      this.router.navigate(["/"]).catch(console.error);
    }
  }
}
