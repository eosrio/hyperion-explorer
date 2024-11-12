import {Component, inject, ResourceRef} from '@angular/core';
import {ContractExplorerComponent} from "../../components/contract-explorer/contract-explorer.component";
import {ActivatedRoute} from "@angular/router";
import {rxResource} from "@angular/core/rxjs-interop";
import {map} from "rxjs";

function rxResFromParam(route: ActivatedRoute, key: string): ResourceRef<string | null> {
  return rxResource<string | null, unknown>({
    loader: () => route.paramMap.pipe(map(p => p.get(key)))
  });
}

@Component({
  selector: 'app-contract',
  imports: [
    ContractExplorerComponent
  ],
  templateUrl: './contract.component.html',
  styleUrl: './contract.component.css'
})
export class ContractComponent {
  route = inject(ActivatedRoute);
  code = rxResFromParam(this.route, 'code');
  table = rxResFromParam(this.route, 'table');
  scope = rxResFromParam(this.route, 'scope');
}
