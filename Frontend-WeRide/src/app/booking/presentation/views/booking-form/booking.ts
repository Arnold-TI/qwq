import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-booking-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.html',
  styleUrls: ['./booking.css']
})
export class BookingFormComponent {
  vehicles = [
    { id: '1', brand: 'Lime', model: 'S-300 Electric Scooter', location: 'Downtown Station A', rate: 0.15, type: 'E-Scooter', battery: '85%', range: '25 km' },
    { id: '2', brand: 'Bird', model: 'One Electric Scooter', location: 'Mall Parking B', rate: 0.20, type: 'E-Scooter', battery: '92%', range: '30 km' },
    { id: '3', brand: 'Spin', model: 'Scoot Pro', location: 'Airport Zone C', rate: 0.18, type: 'E-Scooter', battery: '78%', range: '22 km' },
    { id: '4', brand: 'Jump', model: 'E-Bike City', location: 'University Campus', rate: 0.25, type: 'E-Bike', battery: '88%', range: '45 km' },
    { id: '5', brand: 'Lime', model: 'E-Bike Gen 4', location: 'Central Park', rate: 0.22, type: 'E-Bike', battery: '95%', range: '50 km' },
    { id: '6', brand: 'Veo', model: 'Cosmo E-Scooter', location: 'Business District', rate: 0.16, type: 'E-Scooter', battery: '82%', range: '28 km' },
    { id: '7', brand: 'Tier', model: 'Electric Scooter', location: 'Shopping Center', rate: 0.19, type: 'E-Scooter', battery: '90%', range: '32 km' },
    { id: '8', brand: 'Dott', model: 'E-Scooter Pro', location: 'Train Station', rate: 0.17, type: 'E-Scooter', battery: '86%', range: '26 km' }
  ];
  selectedVehicle: string = '';
  selectedDate: string = '';
  unlockTime: string = '';
  duration: number = 1;
  rate: number = 0;
  showSummary: boolean = false;
  smsReminder: boolean = false;
  emailConfirmation: boolean = false;
  pushNotification: boolean = false;

  getVehicleName(id: string): string {
    const v = this.vehicles.find(vehicle => vehicle.id === id);
    return v ? `${v.brand} ${v.model}` : '';
  }

  getVehicleType(id: string): string {
    const v = this.vehicles.find(vehicle => vehicle.id === id);
    return v ? v.type : '';
  }

  getVehicleBattery(id: string): string {
    const v = this.vehicles.find(vehicle => vehicle.id === id);
    return v ? v.battery : '';
  }

  getVehicleRange(id: string): string {
    const v = this.vehicles.find(vehicle => vehicle.id === id);
    return v ? v.range : '';
  }

  submitBooking() {
    const vehicle = this.vehicles.find(v => v.id === this.selectedVehicle);
    this.rate = vehicle ? vehicle.rate : 0;
    this.showSummary = true;
    // Here you could add the logic to send the booking to the backend
  }

  saveDraft() {
    this.showSummary = true;
    // Here you could save the draft locally or to the backend
  }
}
