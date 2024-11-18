import {Component, inject} from '@angular/core';
import {DataService} from "../../services/data.service";
import {PreHeaderComponent} from "../../components/pre-header/pre-header.component";

@Component({
  selector: 'app-error',
  imports: [PreHeaderComponent],
  templateUrl: './error.component.html',
  styleUrl: './error.component.css'
})
export class ErrorComponent {
  ds = inject(DataService);
}
