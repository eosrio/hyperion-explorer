import { nameBreaks } from "../../name-breaks";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatIcon } from "@angular/material/icon";
import { Component, computed, input, ChangeDetectionStrategy, signal } from "@angular/core";
import { KeyValuePipe, NgTemplateOutlet } from "@angular/common";
import { RouterLink } from "@angular/router";
import { parseAsset } from "../../action-grammar";

function charToSymbol(c: number) {
  if (c >= "a".charCodeAt(0) && c <= "z".charCodeAt(0)) {
    return c - "a".charCodeAt(0) + 6;
  }
  if (c >= "1".charCodeAt(0) && c <= "5".charCodeAt(0)) {
    return c - "1".charCodeAt(0) + 1;
  }
  return 0;
}

/** Fields that carry an Antelope symbol code, which ABIs without a symbol_code type serialize as a raw integer. */
const symbolCodeFields = new Set(["sym_code", "symbol_code", "symcode"]);

/** Decode a raw symbol code (for example 1163020631) into its ticker ("WIRE"), or null when it is not one. */
export function decodeSymbolCode(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (!/^[1-9]\d{0,19}$/.test(String(value))) return null;
  let raw = BigInt(value);
  let code = "";
  while (raw > 0n) {
    const char = Number(raw & 0xffn);
    if (char < 65 || char > 90) return null;
    code += String.fromCharCode(char);
    raw >>= 8n;
  }
  return code.length <= 7 ? code : null;
}

/**
 * Token contracts scope their `stat` rows by symbol code stored as a name ("........ehgp3" is WIRE). Read such a
 * scope back as its ticker, or null for an ordinary account-style scope.
 */
export function symbolFromScope(scope: string): string | null {
  if (!/^[a-z1-5.]{1,13}$/.test(scope) || !scope.startsWith(".")) return null;
  let value = 0n;
  for (let i = 0; i < scope.length; i++) {
    const c = BigInt(charToSymbol(scope.charCodeAt(i)));
    value |= i < 12 ? (c & 0x1fn) << BigInt(64 - 5 * (i + 1)) : c & 0x0fn;
  }
  return decodeSymbolCode(value.toString());
}

/** Regex pattern matching an Antelope/EOSIO name, case-sensitive. */
const namePattern = /^[a-z1-5.]{0,13}$/;

function stringToName(s: string) {
  const a = new Uint8Array(8);
  let bit = 63;
  for (let i = 0; i < s.length; ++i) {
    let c = charToSymbol(s.charCodeAt(i));
    if (bit < 5) {
      c = c << 1;
    }
    for (let j = 4; j >= 0; --j) {
      if (bit >= 0) {
        a[Math.floor(bit / 8)] |= ((c >> j) & 1) << (bit % 8);
        --bit;
      }
    }
  }
  return a;
}

@Component({
  selector: "app-act-data-view",
  imports: [KeyValuePipe, RouterLink, NgTemplateOutlet, CdkCopyToClipboard, MatIcon],
  templateUrl: "./act-data-view.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./act-data-view.component.css"
})
export class ActDataViewComponent {
  data = input<any>(null);
  level = input(0);
  fieldName = input<any>(null);
  /** Table cells and cards: shorten long keys and hashes, and fold nested objects behind a count. */
  compact = input(false);
  readonly copied = signal(false);

  /** Middle truncation keeps both ends of a key or hash recognisable: "PUB_K1_5i2T…p5MGNf". */
  shorten(value: unknown): string {
    const text = String(value);
    return text.length > 20 ? `${text.slice(0, 11)}…${text.slice(-6)}` : text;
  }

  rootType = computed(() => {
    return typeof this.data();
  });

  objectKeyCount = computed(() => {
    try {
      return Object.keys(this.data()).length;
    } catch (e) {
      return 0;
    }
  });

  // constructor() {
  //   effect(() => {
  //     if (this.fieldName()) {
  //       console.log(`ActData(${this.level()}) @ ${this.fieldName()}`, this.data());
  //     } else {
  //       console.log(`ActData(${this.level()})`, this.data());
  //     }
  //   });
  // }

  getType(subitem: any): "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" {
    return typeof subitem;
  }

  protected readonly Array = Array;

  isAccountName(value: unknown, field = this.fieldName()): boolean {
    const accountFields = new Set([
      "account",
      "account_name",
      "finalizer_name",
      "actor",
      "owner",
      "issuer",
      "payer",
      "from",
      "to",
      "receiver",
      "proxy",
      "producer",
      "producers",
      "voter",
      "creator"
    ]);
    return typeof value === "string" && value.length > 0 && accountFields.has(String(field)) && namePattern.test(value);
  }

  /** Keep the action's own field order (from, to, quantity, memo) instead of sorting keys alphabetically. */
  readonly keepOrder = () => 0;
  readonly nameBreaks = nameBreaks;
  readonly asset = parseAsset;

  /** Long unbroken values (keys, signatures, hashes) read better in a fixed-width face that wraps anywhere. */
  isDense(value: unknown): boolean {
    const text = String(value);
    return text.length > 24 && !text.includes(" ");
  }

  symbolCode(value: unknown, field: unknown): string | null {
    return symbolCodeFields.has(String(field)) ? decodeSymbolCode(value) : null;
  }

  protected readonly String = String;
}
