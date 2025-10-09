import { Observable } from 'rxjs';
import { Booking, BookingExtension } from '../model/booking.entity';
import { ReservationTimer } from '../model/reservation-timer.entity';

export abstract class BookingRepository {
  // Operaciones básicas de reserva
  abstract createBooking(booking: Booking): Observable<Booking>;
  abstract getBookingById(id: string): Observable<Booking>;
  abstract getActiveBookingByUserId(userId: string): Observable<Booking | null>;
  abstract getUserBookings(userId: string, limit?: number): Observable<Booking[]>;
  abstract updateBookingStatus(id: string, status: string): Observable<boolean>;
  abstract cancelBooking(id: string, reason?: string): Observable<boolean>;

  // Operaciones de extensión
  abstract extendBooking(bookingId: string, extension: BookingExtension): Observable<boolean>;
  abstract getBookingExtensions(bookingId: string): Observable<BookingExtension[]>;

  // Operaciones de timer
  abstract createTimer(timer: ReservationTimer): Observable<ReservationTimer>;
  abstract updateTimer(timer: ReservationTimer): Observable<boolean>;
  abstract getActiveTimers(): Observable<ReservationTimer[]>;
  abstract getTimerByBookingId(bookingId: string): Observable<ReservationTimer | null>;

  // Consultas especializadas
  abstract getExpiringBookings(minutesFromNow: number): Observable<Booking[]>;
  abstract getScheduledBookings(fromTime: Date, toTime: Date): Observable<Booking[]>;
}
