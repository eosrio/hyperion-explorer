import { afterNextRender, Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { DataService } from "../../services/data.service";
import { PreHeaderComponent } from "../../components/pre-header/pre-header.component";
import { animate } from "motion";
import { Router } from "@angular/router";

@Component({
  selector: "app-error",
  imports: [PreHeaderComponent],
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
    afterNextRender(() => {
      animate([
        ["#error-icon", { y: [50, 0], rotate: [-20, 0] }, { type: "spring", stiffness: 60, damping: 4 }],
        ["#error-text1", { opacity: [0, 1], y: ["50%", 0] }, { at: 0.5 }],
        ["#error-text2", { opacity: [0, 1], y: ["-50%", 0] }, { at: 0.5 }],
        ["#error-reason", { opacity: [0, 1], x: [-50, 0] }]
      ]);
    });
  }
}
