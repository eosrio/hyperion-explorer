import {Component} from '@angular/core';
import {NgOptimizedImage} from "@angular/common";
import {RouterLink} from "@angular/router";
import {DataService} from "../../services/data.service";

@Component({
  selector: 'app-pre-header',
  imports: [
    NgOptimizedImage,
    RouterLink
  ],
  templateUrl: './pre-header.component.html',
  standalone: true,
  styleUrl: './pre-header.component.css'
})
export class PreHeaderComponent {

  chainData = this.data.explorerMetadata;
  constructor(private data: DataService) {
  }

}
