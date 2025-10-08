import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

interface Booking {
  id: string;
  vehicle: string;
  location: string;
  date: string;
  time: string;
  duration: number;
  total: number;
  status: 'active' | 'completed' | 'cancelled';
}

@Component({
  selector: 'app-booking-list',
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './booking-list.html',
  styleUrl: './booking-list.css'
})
export class BookingListComponent {
  bookings: Booking[] = [
    {
      id: '1',
      vehicle: 'Lime S-300 Electric Scooter',
      location: 'Downtown Station A',
      date: '2024-01-15',
      time: '10:00 AM',
      duration: 45,
      total: 6.75,
      status: 'active'
    },
    {
      id: '2',
      vehicle: 'Jump E-Bike City',
      location: 'University Campus',
      date: '2024-01-10',
      time: '2:00 PM',
      duration: 30,
      total: 7.50,
      status: 'completed'
    },
    {
      id: '3',
      vehicle: 'Bird One Electric Scooter',
      location: 'Mall Parking B',
      date: '2024-01-12',
      time: '3:30 PM',
      duration: 25,
      total: 5.00,
      status: 'completed'
    }
  ];

  editBooking(id: string) {
    // Navigate to edit form
    console.log('Edit booking:', id);
  }

  cancelBooking(id: string) {
    // Logic to cancel booking
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = 'cancelled';
    }
    console.log('Cancel booking:', id);
  }
}
