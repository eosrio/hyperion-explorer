import {Component, ElementRef, Input, input, OnInit, signal, viewChild} from '@angular/core';
import {MatButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {toObservable} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-animated-button',
  standalone: true,
  imports: [
    MatButton,
    MatIcon
  ],
  templateUrl: './animated-button.component.html',
  styleUrl: './animated-button.component.css'
})
export class AnimatedButtonComponent implements OnInit {

  btnDiv = viewChild(MatButton);
  buttonText = input.required<string>();
  buttonColor = input.required<string>();
  duration = input.required<number>();

  $textInput = toObservable(this.buttonText);

  $colorInput = toObservable(this.buttonColor);

  activeText = signal("");

  width = signal<string | number>('unset');
  color = signal<string>("unset");

  constructor() {

    this.$colorInput.subscribe(nextColor => {
      this.color.set(nextColor);
    });

    this.$textInput.subscribe((text: string) => {

      if (text) {

        let diff = (text.length - this.activeText().length);
        console.log('diff', diff);
        if (this.width() !== 'unset') {
          const nextWidth = this.width() as number + (diff * 6);
          console.log('nextWidth', nextWidth);
          this.width.set(nextWidth);

          if (this.btnDiv()) {
            const ref = this.btnDiv()?._elementRef as ElementRef<HTMLButtonElement>;
            if (ref) {
              ref.nativeElement.style.setProperty('width', `${nextWidth}px`);
            }
          }
        }

        if (!this.activeText()) {
          this.activeText.set(text);
        } else {

          let eqCharSplitIdx = 0;

          const currentText = this.activeText();
          for (let i = 0; i < text.length; i++) {
            if (text[i] !== currentText[i]) {
              eqCharSplitIdx = i;
              break;
            }
          }

          console.log(`Split at: ${eqCharSplitIdx}`);

          let feedText = this.activeText().substring(0, eqCharSplitIdx);

          console.log(feedText);

          let cursor = 0;
          const typeInterval = setInterval(() => {
            if (cursor < (text.length - eqCharSplitIdx)) {
              feedText += text[cursor + eqCharSplitIdx];
              this.activeText.set(feedText);
              cursor++;
            } else {
              clearInterval(typeInterval);
            }
          }, this.duration() / (text.length - eqCharSplitIdx));
        }
      }
    });
  }

  ngOnInit(): void {
    // Get current rendered width
    if (this.btnDiv()) {
      const ref = this.btnDiv()?._elementRef as ElementRef<HTMLButtonElement>;
      if (ref) {
        this.width.set(ref.nativeElement.offsetWidth + 20);
        ref.nativeElement.style.setProperty('width', `${ref.nativeElement.offsetWidth}px`);
        ref.nativeElement.style.setProperty('transition', `width ${this.duration()}ms, background-color ${this.duration()}ms`);
      }
    }
  }
}
