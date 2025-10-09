import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { BookingTimerService } from '../../domain/services/booking-timer.service';
import { NotificationSchedulerService } from '../../domain/services/notification-scheduler.service';
import { Booking } from '../../domain/model/booking.entity';

export interface CreateReservationRequest {
  userId: string;
  vehicleId: string;
  locationId: string;
  scheduledStartTime: Date;
  durationMinutes: number;
  notificationPreferences: {
    startNotification: boolean;
    endingNotification: boolean;
    methods: string[];
    advanceMinutes: number;
  };
}

export interface CreateReservationResponse {
  success: boolean;
  booking?: Booking;
  timerId?: string;
  message: string;
  errorCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CreateReservationUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private timerService: BookingTimerService,
    private notificationService: NotificationSchedulerService
  ) {}

  execute(request: CreateReservationRequest): Observable<CreateReservationResponse> {
    return this.validateReservationRequest(request).pipe(
      switchMap(isValid => {
        if (!isValid) {
          return throwError(() => new Error('Invalid reservation request'));
        }
        return this.createBooking(request);
      }),
      switchMap(booking => this.setupBookingTimer(booking, request.durationMinutes)),
      switchMap(booking => this.scheduleNotifications(booking, request.notificationPreferences)),
      map(booking => ({
        success: true,
        booking,
        timerId: booking.timer?.id,
        message: 'Reserva creada exitosamente'
      })),
      catchError(error => this.handleError(error))
    );
  }

  private validateReservationRequest(request: CreateReservationRequest): Observable<boolean> {
    // Validaciones específicas US-17
    if (!request.userId || !request.vehicleId) {
      return of(false);
    }

    if (request.scheduledStartTime <= new Date()) {
      return of(false);
    }

    if (request.durationMinutes < 5 || request.durationMinutes > 480) { // 5 min - 8 horas
      return of(false);
    }

    // Validar disponibilidad del vehículo
    return this.bookingRepository.getActiveBookingByUserId(request.userId).pipe(
      map(existingBooking => !existingBooking), // Usuario no debe tener reserva activa
      catchError(() => of(true))
    );
  }

  private createBooking(request: CreateReservationRequest): Observable<Booking> {
    const booking: Booking = {
      id: this.generateBookingId(),
      userId: request.userId,
      vehicleId: request.vehicleId,
      locationId: request.locationId,
      status: 'confirmed',
      createdAt: new Date(),
      reservedAt: new Date(),
      scheduledStartTime: request.scheduledStartTime,
      scheduledEndTime: new Date(request.scheduledStartTime.getTime() + (request.durationMinutes * 60000)),
      allowExtensions: true,
      maxExtensionMinutes: 120,
      notificationPreferences: request.notificationPreferences,
      estimatedCost: this.calculateEstimatedCost(request.durationMinutes),
      extensions: []
    };

    return this.bookingRepository.createBooking(booking);
  }

  private setupBookingTimer(booking: Booking, durationMinutes: number): Observable<Booking> {
    return this.timerService.startTimer(booking.id, durationMinutes).pipe(
      map(timer => ({
        ...booking,
        timer
      }))
    );
  }

  private scheduleNotifications(booking: Booking, preferences: any): Observable<Booking> {
    const notificationPromises: Observable<boolean>[] = [];

    if (preferences.startNotification) {
      notificationPromises.push(
        this.notificationService.scheduleBookingStartNotification(
          booking.id,
          booking.scheduledStartTime
        )
      );
    }

    if (preferences.endingNotification) {
      notificationPromises.push(
        this.notificationService.scheduleBookingEndNotification(
          booking.id,
          preferences.advanceMinutes
        )
      );
    }

    // Si no hay notificaciones que programar, retornar el booking directamente
    if (notificationPromises.length === 0) {
      return of(booking);
    }

    // Ejecutar todas las programaciones de notificaciones en paralelo
    return new Observable(observer => {
      Promise.all(notificationPromises.map(obs => obs.toPromise()))
        .then(() => {
          observer.next(booking);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  private calculateEstimatedCost(durationMinutes: number): number {
    const baseRate = 0.50; // $0.50 por minuto
    return durationMinutes * baseRate;
  }

  private generateBookingId(): string {
    return 'booking-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private handleError(error: any): Observable<CreateReservationResponse> {
    let errorMessage = 'Error al crear la reserva';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.message.includes('vehicle not available')) {
      errorMessage = 'El vehículo no está disponible en el horario seleccionado';
      errorCode = 'VEHICLE_NOT_AVAILABLE';
    } else if (error.message.includes('invalid time')) {
      errorMessage = 'La hora seleccionada no es válida';
      errorCode = 'INVALID_TIME';
    } else if (error.message.includes('connection')) {
      errorMessage = 'Error de conexión. Intenta de nuevo';
      errorCode = 'CONNECTION_ERROR';
    }

    return of({
      success: false,
      message: errorMessage,
      errorCode
    });
  }
}
