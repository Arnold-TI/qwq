import { Routes } from '@angular/router';

export const BOOKING_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'form',
    loadComponent: () => import('./booking-form/booking').then(m => m.BookingFormComponent)
  },
  {
    path: 'list',
    loadComponent: () => import('./booking-list/booking-list').then(m => m.BookingListComponent)
  },
  {
    path: 'unlock-status',
    loadComponent: () => import('./vehicle-unlock-status/vehicle-unlock-status').then(m => m.VehicleUnlockStatusComponent)
  },
  {
    path: 'schedule-unlock',
    loadComponent: () => import('./schedule-unlock/schedule-unlock').then(m => m.ScheduleUnlockComponent)
  },
];
