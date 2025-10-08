import { Component } from '@angular/core';
import {TripMap} from '../trip-map/trip-map';
import {TripDetails} from '../trip-details/trip-details';

@Component({
  selector: 'app-trip-layout',
  imports: [
    TripMap,
    TripDetails
  ],
  templateUrl: './trip-layout.html',
  styleUrl: './trip-layout.css'
})
export class TripLayout {

}
