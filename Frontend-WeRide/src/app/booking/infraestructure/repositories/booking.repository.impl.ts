import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { Booking, BookingExtension } from '../../domain/model/booking.entity';
import { ReservationTimer } from '../../domain/model/reservation-timer.entity';

@Injectable({
  providedIn: 'root'
})
export class BookingRepositoryImpl extends BookingRepository {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {
    super();
  }

  createBooking(booking: Booking): Observable<Booking> {
    return this.http.post<Booking>(`${this.API_URL}/bookings`, booking).pipe(
      catchError(this.handleError)
    );
  }

  getBookingById(id: string): Observable<Booking> {
    return this.http.get<Booking>(`${this.API_URL}/bookings/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getActiveBookingByUserId(userId: string): Observable<Booking | null> {
    return this.http.get<Booking[]>(`${this.API_URL}/bookings?userId=${userId}&status=active`).pipe(
      map(bookings => bookings.length > 0 ? bookings[0] : null),
      catchError(this.handleError)
    );
  }

  getUserBookings(userId: string, limit?: number): Observable<Booking[]> {
    const limitParam = limit ? `&_limit=${limit}` : '';
    return this.http.get<Booking[]>(`${this.API_URL}/bookings?userId=${userId}${limitParam}`).pipe(
      catchError(this.handleError)
    );
  }

  updateBookingStatus(id: string, status: string): Observable<boolean> {
    return this.http.patch(`${this.API_URL}/bookings/${id}`, { status }).pipe(
      map(() => true),
      catchError(this.handleError)
    );
  }

  cancelBooking(id: string, reason?: string): Observable<boolean> {
    return this.http.patch(`${this.API_URL}/bookings/${id}`, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    }).pipe(
      map(() => true),
      catchError(this.handleError)
    );
  }

  extendBooking(bookingId: string, extension: BookingExtension): Observable<boolean> {
    return this.getBookingById(bookingId).pipe(
      switchMap(booking => {
        const updatedBooking = {
          ...booking,
          extensions: [...(booking.extensions || []), extension],
          scheduledEndTime: new Date(
            new Date(booking.scheduledEndTime).getTime() + (extension.additionalMinutes * 60000)
          ).toISOString()
        };

        return this.http.put(`${this.API_URL}/bookings/${bookingId}`, updatedBooking);
      }),
      map(() => true),
      catchError(this.handleError)
    );
  }

  getBookingExtensions(bookingId: string): Observable<BookingExtension[]> {
    return this.getBookingById(bookingId).pipe(
      map(booking => booking.extensions || [])
    );
  }

  createTimer(timer: ReservationTimer): Observable<ReservationTimer> {
    return this.http.post<ReservationTimer>(`${this.API_URL}/reservation-timers`, timer).pipe(
      catchError(this.handleError)
    );
  }

  updateTimer(timer: ReservationTimer): Observable<boolean> {
    return this.http.put(`${this.API_URL}/reservation-timers/${timer.id}`, timer).pipe(
      map(() => true),
      catchError(this.handleError)
    );
  }

  getActiveTimers(): Observable<ReservationTimer[]> {
    return this.http.get<ReservationTimer[]>(`${this.API_URL}/reservation-timers?status=active`).pipe(
      catchError(this.handleError)
    );
  }

  getTimerByBookingId(bookingId: string): Observable<ReservationTimer | null> {
    return this.http.get<ReservationTimer[]>(`${this.API_URL}/reservation-timers?bookingId=${bookingId}`).pipe(
      map(timers => timers.length > 0 ? timers[0] : null),
      catchError(this.handleError)
    );
  }

  getExpiringBookings(minutesFromNow: number): Observable<Booking[]> {
    const futureTime = new Date(Date.now() + (minutesFromNow * 60000));
    return this.http.get<Booking[]>(`${this.API_URL}/bookings?status=active`).pipe(
      map(bookings => bookings.filter(booking => {
        const endTime = new Date(booking.scheduledEndTime);
        return endTime <= futureTime;
      })),
      catchError(this.handleError)
    );
  }

  getScheduledBookings(fromTime: Date, toTime: Date): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.API_URL}/bookings?status=confirmed`).pipe(
      map(bookings => bookings.filter(booking => {
        const startTime = new Date(booking.scheduledStartTime);
        return startTime >= fromTime && startTime <= toTime;
      })),
      catchError(this.handleError)
    );
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      switch (error.status) {
        case 400:
          errorMessage = 'Solicitud inválida';
          break;
        case 401:
          errorMessage = 'No autorizado';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 500:
          errorMessage = 'Error interno del servidor';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
