import {afterNextRender, Component, inject} from '@angular/core';
import {DataService} from "../../services/data.service";
import {PreHeaderComponent} from "../../components/pre-header/pre-header.component";
import {animate} from "motion";

@Component({
  selector: 'app-error',
  imports: [PreHeaderComponent],
  templateUrl: './error.component.html',
  styleUrl: './error.component.css'
})
export class ErrorComponent {
  ds = inject(DataService);

  constructor() {
    afterNextRender(() => {
      animate([
        ["#error-icon", {y: [50, 0], rotate: [-20, 0]}, {type: "spring", stiffness: 60, damping: 5}],
        ["#error-text1", {opacity: [0, 1], y: ["50%", 0]}, {at: 0.5}],
        ["#error-text2", {opacity: [0, 1], y: ["-50%", 0]}, {at: 0.5}],
        ["#error-reason", {opacity: [0, 1], x: [-50, 0]}],
      ]);
    });
  }
}
