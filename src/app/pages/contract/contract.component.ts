import { Component, effect, inject, ResourceRef, ChangeDetectionStrategy } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { DataService } from "../../services/data.service";
import { ContractExplorerComponent } from "../../components/contract-explorer/contract-explorer.component";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { rxResource } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

function rxResFromParam(route: ActivatedRoute, key: string): ResourceRef<string | null | undefined> {
  return rxResource<string | null, unknown>({
    stream: () => route.paramMap.pipe(map(p => p.get(key)))
  });
}

@Component({
  selector: "app-contract",
  imports: [ContractExplorerComponent, RouterLink],
  templateUrl: "./contract.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./contract.component.css"
})
export class ContractComponent {
  route = inject(ActivatedRoute);
  code = rxResFromParam(this.route, "code");
  table = rxResFromParam(this.route, "table");
  scope = rxResFromParam(this.route, "scope");
  private readonly title = inject(Title);
  private readonly data = inject(DataService);

  constructor() {
    // The tab names the contract (and table) being read, like every other explorer page.
    effect(() => {
      const code = this.code.value();
      if (!code) return;
      const table = this.table.value();
      const chain = this.data.explorerMetadata()?.chain_name;
      const subject = table ? `${code} ${table}` : `Contract ${code}`;
      this.title.setTitle(chain ? `${subject} • ${chain} Hyperion Explorer` : `${subject} • Hyperion Explorer`);
    });
  }
}
