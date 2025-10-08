import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Booking } from '../domain/model/booking.entity';

@Injectable({ providedIn: 'root' })
export class BookingStore {
  private bookingsSubject = new BehaviorSubject<Booking[]>([]);
  private selectedBookingSubject = new BehaviorSubject<Booking | null>(null);

  getBookings(): Observable<Booking[]> {
    return this.bookingsSubject.asObservable();
  }

  addBooking(booking: Booking): void {
    const current = this.bookingsSubject.getValue();
    this.bookingsSubject.next([...current, booking]);
  }

  updateBooking(updated: Booking): void {
    const current = this.bookingsSubject.getValue();
    const updatedList = current.map(b => b.id === updated.id ? updated : b);
    this.bookingsSubject.next(updatedList);
  }

  selectBooking(id: string): void {
    const current = this.bookingsSubject.getValue();
    const found = current.find(b => b.id === id) || null;
    this.selectedBookingSubject.next(found);
  }

  getSelectedBooking(): Observable<Booking | null> {
    return this.selectedBookingSubject.asObservable();
  }

  clearSelectedBooking(): void {
    this.selectedBookingSubject.next(null);
  }
}

