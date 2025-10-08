import { Component } from '@angular/core';
import {MatCard} from '@angular/material/card';
import {MatButton, MatIconButton} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';

@Component({
  selector: 'app-trip-details',
  imports: [
    MatCard,
    MatButton,
    CommonModule,
  ],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.css'
})
export class TripDetails {
  location = 'Av.Arequipa 1250 (Miraflores)';
  battery = 85;
  remainingTime = '07:45 min';
  extraTime = 'Aun no sobrepasas tu tiempo';
  rating = 0;

  constructor(private router: Router) {}

  setRating(stars: number) {
    this.rating = stars;
  }

  goToHistory() {
    this.router.navigate(['/trip/history']);
  }

  goToSettings() {
    /**
     * TODO: Implementar la lógica de navegación a la pantalla de configuración
     */
  }
}
