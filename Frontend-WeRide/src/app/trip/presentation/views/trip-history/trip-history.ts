import { Component } from '@angular/core';
import { CommonModule} from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {Router} from '@angular/router';

interface Trip {
  route: string;
  date: string;
  vehicle: string;
  duration: string;
  distance: string;
  id: string;
  image: string;
}

@Component({
  selector: 'app-trip-history',
  standalone: true,
  imports: [MatIconModule, MatIconButton, CommonModule],
  templateUrl: './trip-history.html',
  styleUrl: './trip-history.css'
})

export class TripHistory {
  trips: Trip[] = [
    {
      route: '1068 Av. la Molina - 221 Av. Paz Soldán',
      date: '12 Sept, 10:35 AM',
      vehicle: 'Scooter Eléctrico',
      duration: '55 min',
      distance: '27.4 km',
      id: '935d73bd-1ab5-437e-a678-e03c92c94134',
      image: 'assets/scooter-red.png'
    },
    {
      route: '513 Av. Universitaria - 2810 Av. de la Marina',
      date: '17 Sept, 15:10 PM',
      vehicle: 'Scooter Eléctrico',
      duration: '32 min',
      distance: '16.8 km',
      id: 'daab8f54-6cd1-4198-a5a9-4dd3b2a14287',
      image: 'assets/scooter-blue.png'
    },
    {
      route: '1489 Av. Los Quechuas - 2390 Av. Primavera',
      date: '28 Sept, 06:40 AM',
      vehicle: 'Scooter Eléctrico',
      duration: '1h45min',
      distance: '67.2 km',
      id: 'ef9c803c-2aca-4de3-a27b-f74da6bae7d7',
      image: 'assets/scooter-green.png'
    }
  ];
  constructor(private router: Router) {}

  printReceipt(trip: Trip) {
    alert('Imprimiendo recibo del viaje: ' + trip.id);
  }

  viewDetails(trip: Trip) {
    alert('Mostrando detalles del viaje: ' + trip.id);
  }

  seeMore() {
    alert('Cargando más viajes...');
  }

  goBack() {
    this.router.navigate(['/trip']);
  }

}
