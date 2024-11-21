import {Component} from '@angular/core';
import {DataService} from "../../services/data.service";

@Component({
  selector: 'app-pre-header',
  imports: [],
  templateUrl: './pre-header.component.html',
  styleUrl: './pre-header.component.css'
})
export class PreHeaderComponent {

  chainData = this.data.explorerMetadata;

  constructor(private data: DataService) {
  }

}
