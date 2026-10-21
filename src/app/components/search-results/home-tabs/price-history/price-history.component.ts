import { isPlatformBrowser } from "@angular/common";
import { Component, effect, ElementRef, inject, PLATFORM_ID, signal, ChangeDetectionStrategy, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faTag, faTags } from "@fortawesome/free-solid-svg-icons";
import { color, EChartsOption } from "echarts";
import { NgxEchartsModule } from "ngx-echarts";
import { ChainService } from "../../../../services/chain.service";
import { DataService } from "../../../../services/data.service";
import { OraclePair, OracleService } from "../../../../services/oracle.service";
import { describeApiError } from "../../../../api-errors";

@Component({
  selector: "app-price-history",
  imports: [NgxEchartsModule, FaIconComponent, FormsModule],
  templateUrl: "./price-history.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./price-history.component.css"
})
export class PriceHistoryComponent implements OnDestroy {
  platformId = inject(PLATFORM_ID);
  elementRef = inject(ElementRef);
  chain = inject(ChainService);
  data = inject(DataService);
  oracleService = inject(OracleService);
  chartOptions = signal<EChartsOption>({});
  loading = signal(false);
  error = signal("");
  selectedInterval = signal("1h");
  selectedPair = signal("-");
  availablePairs = signal<OraclePair[]>([]);
  selectedPairPrecision = signal(4);
  dataPointsCount = signal(0);
  currentPairPrice = signal<number | null>(null);
  icons = { solid: { tag: faTag, tags: faTags } };
  private revision = 0;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        if (this.data.explorerMetadata()?.oracle && this.chain.systemSymbol.value()) void this.retry();
      });
    }
  }

  ngOnDestroy(): void {
    this.revision++;
  }

  formatPriceForDisplay(price: number): string {
    const precision = Math.min(12, Math.max(2, this.selectedPairPrecision()));
    return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: precision });
  }

  async retry(): Promise<void> {
    const revision = ++this.revision;
    this.loading.set(true);
    this.error.set("");
    try {
      const pairs = await this.oracleService.getPairs();
      if (revision !== this.revision) return;
      this.availablePairs.set(pairs.filter(pair => pair?.name));
      const pair = pairs.find(pair => pair.name === this.data.explorerMetadata()?.oracle?.pair) || pairs[0];
      if (!pair) throw new Error("No oracle pairs are available.");
      this.selectedPair.set(pair.name);
      await this.loadPriceHistory();
    } catch (error) {
      if (revision === this.revision) {
        this.error.set(describeApiError(error));
        this.loading.set(false);
      }
    }
  }

  onIntervalChange(): Promise<void> {
    return this.loadPriceHistory();
  }
  onPairChange(): Promise<void> {
    return this.loadPriceHistory();
  }

  private async loadPriceHistory(): Promise<void> {
    const revision = ++this.revision;
    const pair = this.selectedPair();
    const interval = this.selectedInterval();
    const precision = this.availablePairs().find(item => item.name === pair)?.precision ?? 4;
    this.selectedPairPrecision.set(precision);
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await this.oracleService.getPriceHistory(pair, interval);
      if (revision !== this.revision) return;
      if (!response.histogram?.length) throw new Error("No price history is available for this pair.");
      const style = getComputedStyle(this.elementRef.nativeElement);
      const primary = style.getPropertyValue("--primary").trim();
      const foreground = style.getPropertyValue("--main-text").trim();
      const faded = style.getPropertyValue("--faded").trim();
      const divider = style.getPropertyValue("--line-divider").trim();
      const prices = response.histogram.map(bucket => this.oracleService.convertPrice(bucket.average_price, precision));
      this.dataPointsCount.set(response.histogram.length);
      this.currentPairPrice.set(prices.at(-1) ?? null);
      this.chartOptions.set({
        animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        textStyle: { color: foreground, fontFamily: style.fontFamily },
        grid: { left: 12, right: 16, top: 16, bottom: 70, containLabel: true },
        tooltip: { trigger: "axis", valueFormatter: value => this.formatPriceForDisplay(Number(value)) },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: response.histogram.map(
            bucket =>
              new Date(bucket.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC"
              }) + " UTC"
          ),
          axisLabel: { hideOverlap: true, showMinLabel: false, showMaxLabel: false, color: faded },
          axisLine: { lineStyle: { color: divider } }
        },
        yAxis: {
          type: "value",
          scale: true,
          axisLabel: { color: faded, formatter: value => this.formatPriceForDisplay(value) },
          splitLine: { lineStyle: { color: divider } }
        },
        dataZoom: [
          { type: "inside" },
          {
            type: "slider",
            bottom: 8,
            height: 24,
            textStyle: { color: foreground },
            borderColor: divider,
            backgroundColor: "transparent",
            fillerColor: color.modifyAlpha(primary, 0.15),
            handleStyle: { color: primary }
          }
        ],
        series: [
          {
            name: pair.toUpperCase(),
            type: "line",
            data: prices,
            showSymbol: prices.length <= 10,
            itemStyle: { color: primary },
            areaStyle: { color: color.modifyAlpha(primary, 0.1) },
            sampling: "lttb"
          }
        ]
      });
    } catch (error) {
      if (revision === this.revision) this.error.set(describeApiError(error));
    } finally {
      if (revision === this.revision) this.loading.set(false);
    }
  }
}
