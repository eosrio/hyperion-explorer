import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { DataService } from "./data.service";
import { lastValueFrom } from "rxjs";
import { devEnv } from "../dev.env";

export interface OraclePair {
  name: string;
  precision: number;
}

export interface OracleHistogramBucket {
  timestamp: string;
  doc_count: number;
  average_price: number;
  min_price: number;
  max_price: number;
  median_price: number;
}

export interface OracleHistogramResponse {
  query_time_ms: number;
  scope: string;
  contract: string;
  table: string;
  interval: string;
  time_range: { from: string; to: string };
  total_documents: any;
  histogram: OracleHistogramBucket[];
}

@Injectable({ providedIn: "root" })
export class OracleService {
  data = inject(DataService);
  httpClient = inject(HttpClient);
  mainPair = ''

  async getPriceHistory(scope = "tlosusd", interval = "1h", after?: string, before?: string): Promise<OracleHistogramResponse> {
    try {
      const params: any = { scope, interval };
      if (after) params.after = after;
      if (before) params.before = before;
      const query = new URLSearchParams(params).toString();
      const url = `${devEnv.hyperionApiUrl}/v2/oracle/get_datapoints_histogram?${query}`;
      console.log("Fetching price history from:", url);
      return await lastValueFrom(this.httpClient.get<OracleHistogramResponse>(url));
    } catch (error) {
      console.error("Error fetching price history:", error);
      throw error;
    }
  }

  async getPairs(): Promise<OraclePair[]> {


    this.mainPair = devEnv.defaultTicker.toLowerCase() || "-"
    try {
      const url = `${devEnv.hyperionApiUrl}/v2/oracle/pairs`;
      console.log("Fetching oracle pairs from:", url);
      const response = await lastValueFrom(this.httpClient.get<any[]>(url));

      // Handle both string array and object array responses
      return response.map(item => {
        if (typeof item === "string") {
          // If API returns strings, assume default precision
          return { name: item, precision: 4 };
        } else if (item && typeof item === "object" && item.name) {
          // If API returns objects with name and precision
          return { name: item.name, precision: item.precision || 4 };
        } else {
          // Fallback for unexpected format
          console.warn("Unexpected pair format:", item);
          return { name: String(item), precision: 4 };
        }
      });
    } catch (error) {
      console.error("Error fetching oracle pairs:", error);
      throw error;
    }
  }

  /**
   * Converts raw price value to real price using precision
   * @param rawPrice Raw price from API
   * @param precision Number of decimal places
   * @returns Real price value
   */
  convertPrice(rawPrice: number, precision: number): number {
    return rawPrice / Math.pow(10, precision);
  }
}

