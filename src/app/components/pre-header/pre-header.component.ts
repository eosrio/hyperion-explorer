import {Component} from '@angular/core';
import {NgOptimizedImage} from "@angular/common";
import {RouterLink} from "@angular/router";
import {DataService} from "../../services/data.service";

@Component({
  selector: 'app-pre-header',
  standalone: true,
  imports: [
    NgOptimizedImage,
    RouterLink
  ],
  templateUrl: './pre-header.component.html',
  styleUrl: './pre-header.component.css'
})
export class PreHeaderComponent {

  chainData = this.data.explorerMetadata;
  constructor(private data: DataService) {
  }

}
