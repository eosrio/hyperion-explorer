import {Component, computed, HostListener, inject, OnInit, PLATFORM_ID, resource, signal} from '@angular/core';
import {lastValueFrom} from "rxjs";
import {DataService} from "../../services/data.service";
import {ChainService} from "../../services/chain.service";
import {HttpClient} from "@angular/common/http";

import * as echarts from 'echarts/core';
import {EChartsCoreOption, EChartsType} from 'echarts/core';
import {PieChart} from "echarts/charts";
import {CanvasRenderer} from 'echarts/renderers';
import {LegendComponent, TitleComponent, TooltipComponent} from 'echarts/components';
import {isPlatformBrowser} from "@angular/common";
import {MatDivider} from "@angular/material/divider";
import {ActivatedRoute} from "@angular/router";
import {toObservable} from "@angular/core/rxjs-interop";

echarts.use([PieChart, CanvasRenderer, TitleComponent, TooltipComponent, LegendComponent]);

@Component({
  selector: 'app-top-holders-chart',
  templateUrl: './top-holders-chart.component.html',
  styleUrl: './top-holders-chart.component.css',
  imports: [
    MatDivider
  ]
})
export class TopHoldersChartComponent implements OnInit {

  data = inject(DataService);
  route = inject(ActivatedRoute);
  chainService = inject(ChainService);
  httpClient = inject(HttpClient);
  platformId = inject(PLATFORM_ID);
  private chart?: EChartsType;

  chartReady = signal(false);
  tokenContract = signal('');
  tokenSymbol = signal('');

  allReady = computed(() => {
    return this.chartReady() && this.tokenContract() && this.tokenSymbol() && this.holders.value();
  });

  allReady$ = toObservable(this.allReady);

  // listen for window resize events
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.chart) {
      this.chart.resize();
    }
  }

  ngOnInit() {

    if (isPlatformBrowser(this.platformId)) {
      this.setupECharts();
    }
    this.route.params.subscribe(async (routeParams: any) => {
      if (routeParams.contract) {
        this.tokenContract.set(routeParams.contract);
      }
      if (routeParams.symbol) {
        this.tokenSymbol.set(routeParams.symbol);
      }
    });

    this.allReady$.subscribe(ready => {
      if (ready) {
        this.loadChartData();
      }
    });

  }

  holders = resource<any, any>({
    request: () => {
      return {
        contract: this.tokenContract(),
        symbol: this.tokenSymbol()
      }
    },
    loader: async ({request}) => {
      try {
        const params = `contract=${request.contract}&symbol=${request.symbol}&limit=10`;
        const getTopHolders = this.data.env.hyperionApiUrl + `/v2/state/get_top_holders?${params}`;
        const data = await lastValueFrom(this.httpClient.get(getTopHolders)) as any;
        if (data && data.holders && data.holders.length > 0) {
          return data.holders;
        } else {
          return [];
        }
      } catch (e: any) {
        console.log(e.message);
        return [];
      }
    }
  });

  buildOptions(): EChartsCoreOption {

    const split = this.splitHolders(0.1);

    const useSplitCharts = split.inner.length > 0 && split.outer.length > 0;

    const tokenSymbol = this.tokenSymbol();

    return {
      calculable: true,
      title: {
        left: '50%',
        text: `${tokenSymbol} Top Holders`,
        subtext: `Contract: ${this.tokenContract()} | Symbol: ${tokenSymbol}`,
        textAlign: 'center',
      },
      tooltip: {
        trigger: 'item', formatter: (params: any) => {
          const data = params.data;
          const sharePct = (data.share * 100).toFixed(4);
          return `Balance <br/>${data.name}: ${data.value} ${tokenSymbol} (${sharePct}%)`;
        }
      },
      series: useSplitCharts ? [{
        type: 'pie',
        radius: [0, '30%'],
        label: {
          position: 'inner',
          fontSize: 14
        },
        labelLine: {
          show: false
        },
        data: split.inner
      }, {
        type: 'pie',
        radius: ['45%', '60%'],
        avoidLabelOverlap: false,
        padAngle: 2,
        itemStyle: {borderRadius: 10},
        label: {
          backgroundColor: '#eee',
          borderColor: '#777',
          borderWidth: 1,
          borderRadius: 32,
          formatter: (params: any) => {
            const data = params.data;
            const sharePct = (data.share * 100).toFixed(4);
            return `{acc|${data.name}}\n{pct|${sharePct}%}`;
          },
          rich: {
            acc: {
              padding: [20, 20, 20, 20],
              align: 'center',
              fontSize: 14,
              lineHeight: 20
            },
            pct: {
              align: 'center',
              padding: [10, 10, 10, 10],
              fontSize: 12,
              lineHeight: 20
            }
          }
        },
        labelLine: {
          length: 30
        },
        data: split.outer
      }] : [{
        name: 'Balance',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        padAngle: 5,
        itemStyle: {borderRadius: 10},
        label: {show: false, position: 'center'},
        emphasis: {
          label: {show: true, fontSize: 40, fontWeight: 'bold'}
        },
        labelLine: {show: false},
        data: split.outer
      }]
    };
  }

  private setupECharts() {
    const chartDom = document.getElementById('top-holders-chart');
    if (chartDom) {
      this.chart = echarts.init(chartDom);
      this.chartReady.set(true);
    } else {
      console.log('Failed to find chart element');
      this.chartReady.set(false);
    }
  }

  private loadChartData() {
    if (this.chart && this.allReady()) {
      this.chart.setOption(this.buildOptions());
    }
  }

  // function to split the holders into 2 arrays, based on a custom threshold
  private splitHolders(threshold: number): { inner: any[], outer: any[] } {
    const holders = this.holders.value();
    if (holders) {
      const total = holders.reduce((acc: number, holder: any) => acc + holder.amount, 0);
      const inner: any[] = [];
      const outer: any[] = [];
      let innerTotal = 0;
      let outerTotal = 0;
      holders.forEach((holder: any) => {
        if (holder.amount / total > threshold) {
          inner.push({value: holder.amount, name: holder.owner, share: holder.amount / total});
          innerTotal += holder.amount;
        } else {
          outer.push({value: holder.amount, name: holder.owner, share: holder.amount / total});
          outerTotal += holder.amount;
        }
      });
      if (inner.length > 0) {
        inner.push({value: total - innerTotal, name: 'Others', share: (total - innerTotal) / total});
      }
      console.log('Inner', inner);
      console.log('Outer', outer);
      return {inner, outer};
    } else {
      return {inner: [], outer: []};
    }
  }
}
