import {Component, inject} from '@angular/core';
import {DataService} from "../../services/data.service";

@Component({
  selector: 'app-error',
  imports: [],
  templateUrl: './error.component.html',
  styleUrl: './error.component.css'
})
export class ErrorComponent {
  ds = inject(DataService);
}
