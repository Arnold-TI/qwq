import { Routes } from '@angular/router';

export const PLAN_ROUTES: Routes =
[
  {
    path: '',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('./plan-layout/plan-layout').then(m => m.PlanLayout)
  }
];
