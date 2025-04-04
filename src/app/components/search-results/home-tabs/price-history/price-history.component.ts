import { Component, OnInit, inject, PLATFORM_ID, ElementRef } from '@angular/core'; // Import inject, PLATFORM_ID, ElementRef
import { isPlatformBrowser, CommonModule } from '@angular/common'; // Import isPlatformBrowser
import { NgxEchartsModule } from 'ngx-echarts'; // Keep NgxEchartsModule
import { EChartsOption } from 'echarts';
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {faHandHoldingDollar} from "@fortawesome/free-solid-svg-icons/faHandHoldingDollar";
import {ChainService} from "../../../../services/chain.service";
import {faTag, faTags} from "@fortawesome/free-solid-svg-icons";

// Removed ECharts core/component imports - handled globally now

@Component({
  selector: 'app-price-history',
  standalone: true, // Assuming it should be standalone like other components
  imports: [
    CommonModule,
    NgxEchartsModule,
    FaIconComponent,
    // Add NgxEchartsModule here
  ],
  // Removed providers array
  templateUrl: './price-history.component.html',
  styleUrl: './price-history.component.css'
})
export class PriceHistoryComponent implements OnInit { // Implement OnInit

  platformId = inject(PLATFORM_ID);
  elementRef = inject(ElementRef); // Inject ElementRef
  chartOptions: EChartsOption = {}; // Initialize chartOptions

  chain = inject(ChainService);
  systemSymbol = '';

  icons = {
    solid: {
      price: faHandHoldingDollar,
      tag: faTag,
      tags: faTags
    }
  };

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Re-add browser check for getComputedStyle
      // Get theme colors from CSS variables
      const computedStyle = getComputedStyle(this.elementRef.nativeElement);
      const primaryColor = computedStyle.getPropertyValue('--primary').trim() || 'rgb(75, 192, 192)'; // Fallback primary color
      const fadedColor = computedStyle.getPropertyValue('--faded').trim() || 'rgb(128, 128, 128)'; // Fallback faded color

      // Helper to convert color to rgba with alpha
      const toRgba = (color: string, alpha: number): string => {
        if (color.startsWith('rgb(')) {
          return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
        } else if (color.startsWith('#') && color.length === 7) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        // Add more parsing if needed (e.g., for hex shorthand, hsl)
        return `rgba(75, 192, 192, ${alpha})`; // Fallback rgba
      };

      const areaColor = toRgba(primaryColor, 0.2); // Area color with 0.2 alpha

      // Generate placeholder data
      const base = +new Date(2024, 0, 1); // Start date Jan 1, 2024
      const oneDay = 24 * 3600 * 1000;
      const date = [];
    const data = [Math.random() * 300]; // Initial random price

    for (let i = 1; i < 100; i++) { // Generate 100 data points
      const now = new Date(base + i * oneDay);
      date.push([now.getFullYear(), now.getMonth() + 1, now.getDate()].join('/'));
      data.push(Math.round((Math.random() - 0.5) * 20 + data[i - 1])); // Simulate price fluctuation
    }

    // Define chart options
    this.chartOptions = {
      tooltip: {
        trigger: 'axis',
        position: function (pt: number[]) { // Add type number[] to pt
          return [pt[0], '10%'];
        }
      },
      title: {
        left: 'center',
        text: 'Price History'
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: date
      },
      yAxis: {
        type: 'value',
        boundaryGap: [0, '100%']
      },
      dataZoom: [{ // Enable zooming/panning
        type: 'inside',
        start: 0,
        end: 100
      }, {
        start: 0,
        end: 100,
        // Style the dataZoom slider
        backgroundColor: '#ddd', // Background of the slider area (Corrected property name)
        fillerColor: toRgba(fadedColor, 0.4), // Color of the selected range (semi-transparent faded)
        handleStyle: {
          color: fadedColor, // Color of the handles
          borderWidth: 0,
          shadowBlur: 0, // Remove default shadow
          shadowColor: 'transparent'
        },
        moveHandleStyle: { // Style for the icon inside the handle
          color: fadedColor,
          opacity: 0.7
        },
        emphasis: { // Override hover styles
          handleLabel: { // Add required handleLabel property
            show: true
          },
          handleStyle: {
            color: fadedColor, // Keep faded color on hover
            borderColor: fadedColor, // Match border
            shadowBlur: 0,
            shadowColor: 'transparent'
          },
          moveHandleStyle: {
            color: fadedColor, // Keep faded color on hover
            opacity: 1 // Make slightly more opaque on hover
          }
        },
        textStyle: {
          color: '#333' // Color for the start/end text
        }
      }],
      series: [
        {
          name: 'Placeholder Price',
          type: 'line',
          symbol: 'none',
          sampling: 'lttb', // Optimize rendering for large datasets
          itemStyle: {
            color: primaryColor // Use theme primary color
          },
          areaStyle: { // Optional: Add area fill
            color: areaColor // Use semi-transparent primary color
        },
        data: data
      }
    ]
  };
  } // End isPlatformBrowser check
 } // End ngOnInit
}
