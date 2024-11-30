import {Component, computed, effect, input} from '@angular/core';
import {KeyValuePipe, NgClass, SlicePipe} from "@angular/common";
import {RouterLink} from "@angular/router";
import {MatTooltip} from "@angular/material/tooltip";
import {MatDivider} from "@angular/material/divider";

function charToSymbol(c: number) {
  if (c >= 'a'.charCodeAt(0) && c <= 'z'.charCodeAt(0)) {
    return c - 'a'.charCodeAt(0) + 6;
  }
  if (c >= '1'.charCodeAt(0) && c <= '5'.charCodeAt(0)) {
    return c - '1'.charCodeAt(0) + 1;
  }
  return 0;
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
        a[Math.floor(bit / 8)] |= ((c >> j) & 1) << bit % 8;
        --bit;
      }
    }
  }
  return a;
}

@Component({
  selector: 'app-act-data-view',
  imports: [
    KeyValuePipe,
    NgClass,
    RouterLink,
    SlicePipe,
    MatTooltip,
    MatDivider
  ],
  templateUrl: './act-data-view.component.html',
  styleUrl: './act-data-view.component.css'
})
export class ActDataViewComponent {
  data = input<any>(null);
  level = input(0);
  fieldName = input<any>(null);

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

  isAccountName(value: unknown): boolean {
    const stringVal = value as string;
    if (stringVal) {
      // check if the string is a valid name
      return !!stringVal.match(namePattern);
    } else {
      return false;
    }
  }

  protected readonly String = String;
}
