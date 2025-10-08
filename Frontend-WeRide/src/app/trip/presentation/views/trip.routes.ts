import { Routes } from '@angular/router';

export const TRIP_ROUTES: Routes = [
  {
    path: '',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('./trip-layout/trip-layout').then(m => m.TripLayout)
  },
  {
    path: 'details',
    loadComponent: () => import('./trip-details/trip-details').then(m => m.TripDetails)
  },
  {
    path: 'map',
    loadComponent: () => import('./trip-map/trip-map').then(m => m.TripMap)
  },
  {
    path: 'history',
    loadComponent: () => import('./trip-history/trip-history').then(m => m.TripHistory)
  }
];
