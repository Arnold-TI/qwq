import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  location: string;
  distance: string;
  status: 'Available' | 'Reserved';
  rate: number;
  battery: string;
  range: string;
}

@Component({
  selector: 'app-schedule-unlock',
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './schedule-unlock.html',
  styleUrl: './schedule-unlock.css'
})
export class ScheduleUnlockComponent {
  searchTerm: string = '';
  selectedVehicle: Vehicle | null = null;
  selectedDate: string = '';
  unlockTime: string = '';
  duration: number = 1;
  smsReminder: boolean = false;
  emailConfirmation: boolean = false;
  pushNotification: boolean = false;

  vehicles: Vehicle[] = [
    {
      id: '1',
      brand: 'Lime',
      model: 'S-300 Electric Scooter',
      location: 'Downtown Station A',
      distance: '0.2 miles',
      status: 'Available',
      rate: 0.15,
      battery: '85%',
      range: '25 km'
    },
    {
      id: '2',
      brand: 'Bird',
      model: 'One Electric Scooter',
      location: 'Mall Parking B',
      distance: '0.5 miles',
      status: 'Available',
      rate: 0.20,
      battery: '92%',
      range: '30 km'
    },
    {
      id: '3',
      brand: 'Jump',
      model: 'E-Bike City',
      location: 'University Campus',
      distance: '0.3 miles',
      status: 'Available',
      rate: 0.25,
      battery: '88%',
      range: '45 km'
    },
    {
      id: '4',
      brand: 'Spin',
      model: 'Scoot Pro',
      location: 'Airport Zone C',
      distance: '1.2 miles',
      status: 'Reserved',
      rate: 0.18,
      battery: '78%',
      range: '22 km'
    }
  ];

  filteredVehicles: Vehicle[] = [];

  constructor() {
    this.filteredVehicles = [...this.vehicles];
    // Set default date to today
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    // Set default vehicle
    this.selectedVehicle = this.vehicles[0];
  }

  filterVehicles() {
    if (!this.searchTerm.trim()) {
      this.filteredVehicles = [...this.vehicles];
    } else {
      this.filteredVehicles = this.vehicles.filter(vehicle =>
        vehicle.brand.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        vehicle.location.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  selectVehicle(vehicle: Vehicle) {
    this.selectedVehicle = vehicle;
    this.searchTerm = `${vehicle.brand} ${vehicle.model}`;
    this.filteredVehicles = [];
  }

  formatDateTime(): string {
    if (!this.selectedDate || !this.unlockTime) {
      return 'Select date and time';
    }
    
    const date = new Date(this.selectedDate);
    const time = this.unlockTime;
    
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const [hours, minutes] = time.split(':');
    const hour12 = parseInt(hours) > 12 ? parseInt(hours) - 12 : parseInt(hours);
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hour12}:${minutes} ${ampm}`;
    
    return `${formattedDate} at ${formattedTime}`;
  }

  calculateTotal(): string {
    if (!this.selectedVehicle) return '0.00';
    // Convert hours to minutes for calculation
    const totalMinutes = this.duration * 60;
    return (this.selectedVehicle.rate * totalMinutes).toFixed(2);
  }

  scheduleUnlock() {
    if (!this.selectedVehicle || !this.selectedDate || !this.unlockTime) {
      alert('Please fill in all required fields');
      return;
    }

    console.log('Scheduling unlock:', {
      vehicle: this.selectedVehicle,
      date: this.selectedDate,
      time: this.unlockTime,
      duration: this.duration,
      notifications: {
        sms: this.smsReminder,
        email: this.emailConfirmation,
        push: this.pushNotification
      }
    });

    // Here you would typically send the data to your backend API
    alert('Vehicle unlock scheduled successfully!');
  }

  saveDraft() {
    console.log('Saving draft...');
    // Here you would save the current form state as a draft
    alert('Draft saved successfully!');
  }
}
