import {Component, signal} from '@angular/core';
import {LayoutTransitionComponent} from "../../components/layout-transition/layout-transition.component";
import {MatSlider, MatSliderThumb} from "@angular/material/slider";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  imports: [
    LayoutTransitionComponent,
    MatSlider,
    MatSliderThumb,
    FormsModule
  ],
  styleUrl: './test.component.css'
})
export class TestComponent {
  animationProgress = signal(0);
  headerHeight = signal(500);

  constructor() {
    // // oscillate the animation progress between 0 and 1 every second using a sine wave
    // setInterval(() => {
    //   this.animationProgress.set(Math.sin(Date.now() / 500) / 2 + 0.5);
    // }, 16);
    //
    // // oscillate the header height between 300 and 500 every 3 second using a sine wave
    // setInterval(() => {
    //   this.headerHeight.set(Math.sin(Date.now() / 3000) * 100 + 400);
    // }, 16);
  }
}
