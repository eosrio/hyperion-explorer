import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideRouter } from "@angular/router";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { DataService, DataServiceBrowser } from "../app/services/data.service";

export default [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
  { provide: DataService, useClass: DataServiceBrowser },
  { provide: MAT_DIALOG_DATA, useValue: { account: "eosio", action: {} } },
  { provide: MatDialogRef, useValue: { close() {} } }
];
