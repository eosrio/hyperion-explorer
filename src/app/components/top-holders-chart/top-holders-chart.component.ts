import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, PLATFORM_ID, resource, viewChild } from "@angular/core";
import { DecimalPipe, isPlatformBrowser, PercentPipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { HttpClient } from "@angular/common/http";
import { lastValueFrom } from "rxjs";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { TooltipComponent } from "echarts/components";
import { DataService } from "../../services/data.service";
import { describeApiError } from "../../api-errors";

echarts.use([PieChart, CanvasRenderer, TooltipComponent]);
interface Holder {
  owner: string;
  amount: number;
}
@Component({
  selector: "app-top-holders-chart",
  imports: [DecimalPipe, PercentPipe, RouterLink],
  templateUrl: "./top-holders-chart.component.html",
  styleUrl: "./top-holders-chart.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopHoldersChartComponent {
  readonly data = inject(DataService);
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly tokenContract = computed(() => this.params()?.get("contract") || "");
  readonly tokenSymbol = computed(() => this.params()?.get("symbol") || "");
  readonly chartTarget = viewChild<ElementRef<HTMLElement>>("holderChart");
  readonly describeApiError = describeApiError;
  readonly holders = resource({
    params: () => (this.tokenContract() && this.tokenSymbol() ? { contract: this.tokenContract(), symbol: this.tokenSymbol() } : undefined),
    loader: async ({ params }) => {
      const query = new URLSearchParams({ ...params, limit: "10" });
      const result = await lastValueFrom(
        this.http.get<{ holders: Holder[] }>(`${this.data.env.hyperionApiUrl}/v2/state/get_top_holders?${query}`)
      );
      if (!Array.isArray(result.holders)) throw new Error("Hyperion returned an invalid holder response.");
      return result.holders;
    }
  });
  readonly rows = computed(() => (this.holders.hasValue() ? this.holders.value() : []));
  readonly displayedTotal = computed(() => this.rows().reduce((total, row) => total + row.amount, 0));
  share(amount: number): number {
    return this.displayedTotal() ? amount / this.displayedTotal() : 0;
  }
  constructor() {
    effect(onCleanup => {
      this.data.explorerMetadata(); // Repaint the chart when the chain appearance changes.
      const target = this.chartTarget()?.nativeElement;
      const rows = this.rows();
      if (!isPlatformBrowser(this.platform) || !target || !rows.length) return;
      const chart = echarts.init(target);
      const palette = getComputedStyle(target);
      const primary = palette.getPropertyValue("--primary").trim() || "#00688f";
      const text = palette.getPropertyValue("--main-text").trim() || "#141519";
      chart.setOption({
        animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        animationDuration: 250,
        color: rows.map((_, index) => echarts.color.lift(primary, index * 0.065)),
        textStyle: { color: text, fontFamily: palette.getPropertyValue("--main-font-family") },
        tooltip: {
          trigger: "item",
          confine: true,
          formatter: (params: any) => `${params.name}: ${Number(params.value).toLocaleString()} ${this.tokenSymbol()}`
        },
        series: [
          {
            type: "pie",
            radius: ["48%", "78%"],
            center: ["50%", "50%"],
            label: { show: false },
            labelLine: { show: false },
            emphasis: { scaleSize: 5 },
            data: rows.map(row => ({ name: row.owner, value: row.amount }))
          }
        ]
      });
      const resize = new ResizeObserver(() => chart.resize());
      resize.observe(target);
      onCleanup(() => {
        resize.disconnect();
        chart.dispose();
      });
    });
  }
}
