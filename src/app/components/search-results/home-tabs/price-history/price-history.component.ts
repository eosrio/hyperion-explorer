import { Component, OnInit, inject, PLATFORM_ID, ElementRef, ChangeDetectorRef } from "@angular/core"; // Added ChangeDetectorRef
import { isPlatformBrowser } from "@angular/common"; // Import isPlatformBrowser
import { NgxEchartsModule } from "ngx-echarts"; // Keep NgxEchartsModule
import { EChartsOption } from "echarts";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faHandHoldingDollar } from "@fortawesome/free-solid-svg-icons";
import { ChainService } from "../../../../services/chain.service";
import { faTag, faTags } from "@fortawesome/free-solid-svg-icons";
import { OracleService, OracleHistogramResponse, OraclePair } from "../../../../services/oracle.service";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { devEnv } from "../../../../dev.env";

@Component({
  selector: "app-price-history",
  standalone: true,
  imports: [CommonModule, NgxEchartsModule, FaIconComponent, FormsModule],
  templateUrl: "./price-history.component.html",
  styleUrl: "./price-history.component.css"
})
export class PriceHistoryComponent implements OnInit {
  platformId = inject(PLATFORM_ID);
  elementRef = inject(ElementRef);
  cdr = inject(ChangeDetectorRef);
  chartOptions: EChartsOption = {};

  chain = inject(ChainService);
  oracleService = inject(OracleService);

  loading = false;
  error: string | null = null;
  selectedInterval = "1h";
  selectedPair = "-";
  availablePairs: OraclePair[] = []; // Available trading pairs with precision
  selectedPairPrecision = 4; // Current pair precision
  dataPointsCount = 0; // Track number of data points
  currentPairPrice: number | null = null;

  icons = {
    solid: {
      price: faHandHoldingDollar,
      tag: faTag,
      tags: faTags
    }
  };

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(async () => {
        try {
          // First, load available pairs
          await this.loadAvailablePairs();
          //todo validar a passagem de selectedPair
          if (devEnv) {
            this.selectedPair = devEnv.defaultTicker.toLowerCase() + "usd";
          }

          // Wait for chain data to be available before loading price history
          if (this.chain.systemSymbol?.value && this.chain.systemSymbol.value()) {
            await this.loadPriceHistory();
          } else {
            // If chain data is not ready, wait a bit and try again
            setTimeout(async () => {
              if (this.chain.systemSymbol?.value && this.chain.systemSymbol.value()) {
                await this.loadPriceHistory();
              }
            }, 1000);
          }
        } catch (e) {
          console.error("Error in ngOnInit:", e);
          this.error = "Failed to initialize price history component";
          this.loading = false;
          this.cdr.detectChanges();
        }
      }, 0);
    }
  } // End ngOnInit

  /**
   * Format price values based on their magnitude for better readability
   */
  formatPriceForDisplay(price: number): string {
    if (price === 0) return "$0.00";
    if (Math.abs(price) < 0.000001) {
      return `$${price.toFixed(12)}`;
    } else if (Math.abs(price) < 0.001) {
      return `$${price.toFixed(10)}`;
    } else if (Math.abs(price) < 1) {
      return `$${price.toFixed(8)}`;
    } else {
      return `$${price.toFixed(2)}`;
    }
  }

  async onIntervalChange(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      // Use setTimeout to prevent ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(async () => {
        await this.loadPriceHistory();
      }, 0);
    }
  }

  async onPairChange(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      // Update precision when pair changes
      const pairData = this.availablePairs.find(p => p.name === this.selectedPair);
      if (pairData) {
        this.selectedPairPrecision = pairData.precision;
      }

      // Use setTimeout to prevent ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(async () => {
        await this.loadPriceHistory();
      }, 0);
    }
  }

  private async loadAvailablePairs(): Promise<void> {
    try {
      console.log("Loading available pairs...");
      const pairs = await this.oracleService.getPairs();
      console.log("Loaded pairs:", pairs);

      // Ensure all pairs have the proper structure
      this.availablePairs = pairs.filter(pair => pair && pair.name && typeof pair.name === "string");

      console.log("Filtered pairs:", this.availablePairs);

      // Set default pair to the first one that includes 'usd', or first available
      const usdPair = this.availablePairs.find(pair => pair.name.toLowerCase().includes("usd"));
      if (usdPair) {
        this.selectedPair = usdPair.name;
        this.selectedPairPrecision = usdPair.precision;
        console.log("Selected USD pair:", usdPair);
      } else if (this.availablePairs.length > 0) {
        this.selectedPair = this.availablePairs[0].name;
        this.selectedPairPrecision = this.availablePairs[0].precision;
        console.log("Selected first available pair:", this.availablePairs[0]);
      }

      // Trigger change detection to update template
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Error loading available pairs:", error);
      // Provide fallback pairs to prevent template errors
      this.availablePairs = [{ name: "-", precision: 4 }];
      this.selectedPair = "-";
      this.selectedPairPrecision = 4;
      this.cdr.detectChanges();
    }
  }

  private async loadPriceHistory(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      // Trigger change detection after updating loading state
      this.cdr.detectChanges();

      // Get theme colors from CSS variables
      const computedStyle = getComputedStyle(this.elementRef.nativeElement);
      const primaryColor = computedStyle.getPropertyValue("--primary").trim() || "rgb(75, 192, 192)";
      const fadedColor = computedStyle.getPropertyValue("--faded").trim() || "rgb(128, 128, 128)";

      // Helper to convert color to rgba with alpha
      const toRgba = (color: string, alpha: number): string => {
        if (color.startsWith("rgb(")) {
          return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
        } else if (color.startsWith("#") && color.length === 7) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        // Add more parsing if needed (e.g., for hex shorthand, hsl)
        return `rgba(75, 192, 192, ${alpha})`; // Fallback rgba
      };

      const areaColor = toRgba(primaryColor, 0.2); // Area color with 0.2 alpha

      // Fetch real price history from API using the selected interval and pair
      const response: OracleHistogramResponse = await this.oracleService.getPriceHistory(this.selectedPair, this.selectedInterval);

      if (!response || !response.histogram || response.histogram.length === 0) {
        throw new Error("No price history data available");
      }

      // Store data points count
      this.dataPointsCount = response.histogram.length;

      // Get current price from the most recent data point
      if (response.histogram.length > 0) {
        const latestData = response.histogram[response.histogram.length - 1];
        this.currentPairPrice = this.oracleService.convertPrice(latestData.average_price, this.selectedPairPrecision);
      } else {
        this.currentPairPrice = null;
      }

      // Format dates for better display
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        // For longer intervals (monthly, weekly, daily), show date only; for shorter intervals, show date and time
        if (["1M", "1w", "1d"].includes(this.selectedInterval)) {
          return date.toLocaleDateString("en-US", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC" // Use UTC to avoid timezone issues
          });
        } else {
          return date.toLocaleString("en-US", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC" // Use UTC to avoid timezone issues
          });
        }
      };

      const dates = response.histogram.map(b => formatDate(b.timestamp));
      // Convert raw prices to real prices using precision
      const prices = response.histogram.map(b => this.oracleService.convertPrice(b.average_price, this.selectedPairPrecision));

      // Determine if we should show symbols (for few data points)
      const showSymbols = response.histogram.length <= 10;

      // Check if we have very small values with tiny variations
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const isVerySmallRange = minPrice > 0 && maxPrice > 0 && Math.abs(maxPrice - minPrice) / minPrice < 0.05; // Less than 5% variation

      // For very small ranges, enhance visual contrast
      const enhancedPrices = isVerySmallRange
        ? prices.map(price => {
            // Amplify the relative differences for better visualization
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            const deviation = price - avgPrice;
            return avgPrice + deviation * 3; // Amplify by 3x
          })
        : prices;

      // Define chart options
      this.chartOptions = {
        tooltip: {
          trigger: "axis",
          position: function (pt: number[]) {
            return [pt[0], "10%"];
          },
          formatter: (params: any) => {
            const param = Array.isArray(params) ? params[0] : params;
            const bucket = response.histogram[param.dataIndex]; // Convert raw prices to real prices using precision
            const avgPrice = this.oracleService.convertPrice(bucket.average_price, this.selectedPairPrecision);
            const minPrice = this.oracleService.convertPrice(bucket.min_price, this.selectedPairPrecision);
            const maxPrice = this.oracleService.convertPrice(bucket.max_price, this.selectedPairPrecision);
            const medianPrice = this.oracleService.convertPrice(bucket.median_price, this.selectedPairPrecision);

            // Smart formatting based on value size
            const formatPrice = (price: number): string => {
              if (price === 0) return "$0";
              if (Math.abs(price) < 0.000001) {
                // For very tiny values, use many decimal places
                return `$${price.toFixed(12)}`;
              } else if (Math.abs(price) < 0.001) {
                return `$${price.toFixed(10)}`;
              } else if (Math.abs(price) < 1) {
                return `$${price.toFixed(8)}`;
              } else {
                return `$${price.toFixed(Math.min(this.selectedPairPrecision, 4))}`;
              }
            };

            // Calculate percentage change from first data point if available
            let changeInfo = "";
            if (param.dataIndex > 0 && response.histogram.length > 1) {
              const currentPrice = avgPrice;
              const firstPrice = this.oracleService.convertPrice(response.histogram[0].average_price, this.selectedPairPrecision);
              const changePercent = ((currentPrice - firstPrice) / firstPrice) * 100;
              const changeSymbol = changePercent >= 0 ? "↗" : "↘";
              const changeColor = changePercent >= 0 ? "#10b981" : "#ef4444";
              changeInfo = `<div style="color: ${changeColor};">${changeSymbol} ${changePercent.toFixed(4)}% from start</div>`;
            }

            return `
              <div style="font-weight: bold; margin-bottom: 5px;">${param.name}</div>
              <div>Average Price: ${formatPrice(avgPrice)}</div>
              <div>Min Price: ${formatPrice(minPrice)}</div>
              <div>Max Price: ${formatPrice(maxPrice)}</div>
              <div>Median: ${formatPrice(medianPrice)}</div>
              <div>Samples: ${bucket.doc_count.toLocaleString()}</div>
              ${changeInfo}
            `;
          }
        },
        title: {
          left: "center",
          text: `Price History - ${this.selectedPair.toUpperCase()} (${this.selectedInterval})`,
          subtext: isVerySmallRange ? "* Visual differences amplified for better readability" : "",
          textStyle: {
            fontSize: 16,
            fontWeight: "bold"
          },
          subtextStyle: {
            fontSize: 12,
            color: "#666",
            fontStyle: "italic"
          }
        },
        xAxis: {
          type: "category",
          boundaryGap: response.histogram.length === 1 ? true : false, // Use boundaryGap for single points
          data: dates,
          axisLabel: {
            show: false // Hide x-axis labels since tooltip provides all the info
          },
          axisTick: {
            show: false // Hide x-axis ticks as well
          },
          axisLine: {
            show: true // Keep the axis line for visual reference
          }
        },
        yAxis: {
          type: "value",
          boundaryGap: [0, "5%"],
          axisLabel: {
            formatter: (value: number) => {
              // For very small values, use fixed decimal notation instead of scientific
              if (value === 0) return "$0";
              if (Math.abs(value) < 0.001) {
                // Use fixed notation with enough decimals to show the value properly
                return `$${value.toFixed(10)}`;
              } else if (Math.abs(value) < 1) {
                return `$${value.toFixed(8)}`;
              } else {
                return `$${value.toFixed(2)}`;
              }
            }
          },
          // Ensure proper scaling for very small values
          scale: true,
          min: function (value: any) {
            const minVal = value.min;
            const maxVal = value.max;

            // For very small values with tiny ranges, expand the range for better visualization
            if (minVal > 0 && maxVal > 0 && Math.abs(maxVal - minVal) / minVal < 0.1) {
              // If the range is less than 10% of the minimum value, expand it
              const center = (minVal + maxVal) / 2;
              const expandedRange = center * 0.15; // 15% range around center
              return Math.max(0, center - expandedRange);
            } else if (minVal > 0 && minVal < 0.001) {
              return minVal * 0.9; // 10% below minimum for very small values
            }
            return value.min;
          },
          max: function (value: any) {
            const minVal = value.min;
            const maxVal = value.max;

            // For very small values with tiny ranges, expand the range for better visualization
            if (minVal > 0 && maxVal > 0 && Math.abs(maxVal - minVal) / minVal < 0.1) {
              // If the range is less than 10% of the minimum value, expand it
              const center = (minVal + maxVal) / 2;
              const expandedRange = center * 0.15; // 15% range around center
              return center + expandedRange;
            }
            return value.max;
          }
        },
        dataZoom: [
          {
            type: "inside",
            start: 0,
            end: 100
          },
          {
            start: 0,
            end: 100,
            backgroundColor: "#ddd",
            fillerColor: toRgba(fadedColor, 0.4),
            handleStyle: {
              color: fadedColor,
              borderWidth: 0,
              shadowBlur: 0,
              shadowColor: "transparent"
            },
            moveHandleStyle: {
              color: fadedColor,
              opacity: 0.7
            },
            emphasis: {
              handleLabel: {
                show: true
              },
              handleStyle: {
                color: fadedColor,
                borderColor: fadedColor,
                shadowBlur: 0,
                shadowColor: "transparent"
              },
              moveHandleStyle: {
                color: fadedColor,
                opacity: 1
              }
            },
            textStyle: {
              color: "#333"
            }
          }
        ],
        series: [
          {
            name: "Average Price",
            type: response.histogram.length === 1 ? "bar" : "line", // Use bar chart for single data point
            symbol: showSymbols ? "circle" : "none",
            symbolSize: showSymbols ? 8 : 4,
            sampling: "lttb",
            itemStyle: {
              color: primaryColor
            },
            areaStyle:
              response.histogram.length > 1
                ? {
                    color: areaColor
                  }
                : undefined, // Only show area for multiple points
            data: enhancedPrices, // Use enhanced prices for better visualization
            emphasis: {
              focus: "series"
            },
            lineStyle: {
              width: 2
            },
            // Add smooth curve for better visualization of small changes
            smooth: isVerySmallRange ? 0.3 : false
          }
        ]
      };
    } catch (e: any) {
      console.error("Error loading price history:", e);
      this.error = e?.message || "Failed to load price history.";
    } finally {
      this.loading = false;

      // Trigger change detection after updating loading and error states
      this.cdr.detectChanges();
    }
  }
}

