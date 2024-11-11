import {afterNextRender, Component} from '@angular/core';
import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";


@Component({
  selector: 'app-layout-animation-test',
  imports: [],
  standalone: true,
  templateUrl: './layout-animation-test.component.html',
  styleUrl: './layout-animation-test.component.css'
})
export class LayoutAnimationTestComponent {
  constructor() {
    afterNextRender(() => {
      this.initGsap();
      this.createScrollAnimation();
    });
  }

  initGsap() {
    gsap.registerPlugin(ScrollTrigger);
    // ScrollTrigger.normalizeScroll(true);
  }

  private createScrollAnimation() {
    const headerContainer = document.querySelector('#header-container');
    const logo = document.querySelector('#logo-element') as HTMLDivElement;
    const searchBar = document.querySelector('#search-bar') as HTMLDivElement;
    const contentContainer = document.querySelector('#content-container') as HTMLDivElement;

    const logoGap = 10;

    const scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: headerContainer,
        start: 'top top',
        end: '300px 100px',
        scrub: true,
        markers: false,
        onEnterBack: () => {
          gsap.set(logo, {backgroundColor: 'red'});
        },
        onLeave: () => {
          gsap.set(logo, {backgroundColor: 'blue'});
        },
        onUpdate: (self) => {

          if (contentContainer && contentContainer.style && headerContainer) {
            contentContainer.style.paddingTop = `${headerContainer.clientHeight}px`;
          }

          // update the logo size to match the search bar height
          logo.style.height = `${searchBar.clientHeight}px`;

          // make it vertically centered with the search bar
          const deltaX = searchBar.offsetLeft - logo.offsetLeft - logo.clientWidth - logoGap;
          if (self.progress <= 0.5) {
            const gap = (1 - self.progress * 2) * logoGap;
            logo.style.top = `calc(-${gap}px + ((50% + ${logo.clientHeight / 2}px) * ${self.progress * 2}))`;
            logo.style.transform = `translateX(${(deltaX * self.progress * 2)}px) translateY(-${logo.clientHeight + gap}px)`;
          } else {
            logo.style.top = `0px`;
            logo.style.transform = `translateX(${deltaX}px) translateY(0px)`;
          }
        }
      }
    });

    // set initial opacity to 1
    const gap = (1 - (0)) * logoGap;
    const deltaY = logo.clientHeight + gap;
    gsap.set(logo, {
      borderRadius: "10px",
      opacity: 0,
      transform: `translateX(0px) translateY(-${deltaY}px)`,
    });
    gsap.to(logo, {
      opacity: 1,
      duration: 0.2
    });
    gsap.to(searchBar, {opacity: 1, duration: 0.5});


    scrollTimeline.to(logo, {borderRadius: "30px", duration: 0.5}, 0);
    scrollTimeline.to(searchBar, {height: 40}, 0);
    scrollTimeline.to(headerContainer, {height: 40}, 0);
  }
}
