import {Inject, Injectable, PLATFORM_ID, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  privateKey = signal<string>("");

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    console.log('platformId:', this.platformId);
  }
}
