import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

interface VehicleInfo {
  id: string;
  battery: number;
  brand: string;
  status: 'Locked' | 'Unlocked';
  lastUpdated: string;
}

interface Activity {
  type: 'success' | 'info' | 'error';
  message: string;
  time: string;
}

@Component({
  selector: 'app-vehicle-unlock-status',
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './vehicle-unlock-status.html',
  styleUrl: './vehicle-unlock-status.css'
})
export class VehicleUnlockStatusComponent {
  constructor(private router: Router) {}

  vehicleInfo: VehicleInfo = {
    id: '25759632',
    battery: 35,
    brand: 'Montesa',
    status: 'Locked', // Estado inicial bloqueado
    lastUpdated: '2 minutes ago'
  };

  get unlockStatus(): string {
    return this.vehicleInfo.status;
  }

  get lastUpdated(): string {
    return this.vehicleInfo.lastUpdated;
  }

  recentActivity: Activity[] = [
    {
      type: 'success',
      message: 'Vehicle unlocked successfully',
      time: '2:30 PM'
    },
    {
      type: 'info',
      message: 'Unlock request initiated',
      time: '2:29 PM'
    },
    {
      type: 'error',
      message: 'Connection error - retry attempted',
      time: '2:25 PM'
    }
  ];

  refreshStatus() {
    // Simulación de refresco de estado
    this.vehicleInfo.lastUpdated = 'Just now';
  }

  lockVehicle() {
    this.vehicleInfo.status = 'Locked';
    this.recentActivity.unshift({
      type: 'info',
      message: 'Vehicle locked',
      time: new Date().toLocaleTimeString()
    });
  }

  unlockVehicle() {
    this.vehicleInfo.status = 'Unlocked';
    this.recentActivity.unshift({
      type: 'success',
      message: 'Vehicle unlocked',
      time: new Date().toLocaleTimeString()
    });
    this.router.navigate(['/booking/schedule-unlock']);
  }

  goToScheduleUnlock() {
    this.router.navigate(['/booking/schedule-unlock']);
  }
}
