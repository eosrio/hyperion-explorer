import {Component, signal} from '@angular/core';
import {NgClass} from "@angular/common";
import {MatButton} from "@angular/material/button";
import {animate, style, transition} from '@angular/animations';
import {state, trigger} from "@angular/animations";
import {AnimatedButtonComponent} from "../../components/animated-button/animated-button.component";

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [
    NgClass,
    MatButton,
    AnimatedButtonComponent
  ],
  templateUrl: './test.component.html',
  styleUrl: './test.component.css',
  animations: [
    trigger('flyInOut', [
      transition(':enter', [style({opacity: 0}), animate('500ms', style({opacity: 1}))]),
    ]),
  ],
})
export class TestComponent {

  expanded = signal(false);
  color = signal<string>("#ffffff");

  toggleExpansion() {
    this.expanded.update(value => !value);
    this.color.set("#85d494");
  }

  setColor1() {
    this.color.set("#809bdb");
  }

  setColor2() {
    this.color.set("#9e9b8c");
  }
}
