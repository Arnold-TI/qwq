import { Component } from '@angular/core';
import { CommonModule} from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatCardActions } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

interface Plan{
  benefits: string[];
  price: string;
  duration: string;
  id: string;
}

@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [MatIconModule, CommonModule, MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatCardActions, MatButtonModule],
  templateUrl: './plan-list.html',
  styleUrl: './plan-list.css'
})
export class PlanList {
  plans : Plan[] = [
    {
      // Basic Plan
      benefits: [
        'Acceso a scooters estándar',
        '10% de descuento en cada viaje',
        'Soporte al cliente básico'
      ],
      price: '$3.99',
      duration: 'Mensual',
      id: 'basic-plan-001'
    },
    {
      // Student Plan
      benefits: [
        'Acceso a scooters premium',
        '20% de descuento en cada viaje',
        'Soporte al cliente prioritario',
        'Viajes ilimitados los fines de semana'
      ],
      price: '$5.99',
      duration: 'Mensual',
      id: 'premium-plan-002'
    },
    {
      // Business Plan
      benefits: [
        'Acceso a toda la flota de scooters',
        '30% de descuento en cada viaje',
        'Soporte al cliente 24/7',
        'Informes mensuales de uso',
        'Viajes ilimitados todos los días'
      ],
      price: '$29.99',
      duration: 'Mensual',
      id: 'business-plan-003'
    }
  ];

  selectedPlan: Plan | null = null;

  planTitle(id: string): string {
    switch (id) {
      case 'basic-plan-001': return 'Plan Normal';
      case 'premium-plan-002': return 'Plan Estudiantil';
      case 'business-plan-003': return 'Plan Empresarial';
      default: return 'Plan';
    }
  }

  selectPlan(plan: Plan) {
    this.selectedPlan = plan;
  }
}
