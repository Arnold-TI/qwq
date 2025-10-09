import { Injectable } from '@angular/core';
import { Observable, of, throwError, forkJoin} from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { BookingTimerService } from '../../domain/services/booking-timer.service';
import { NotificationSchedulerService } from '../../domain/services/notification-scheduler.service';
import { Booking, NotificationPreferences } from '../../domain/model/booking.entity';

export interface CreateReservationRequest {
  userId: string;
  vehicleId: string;
  locationId: string;
  scheduledStartTime: Date;
  durationMinutes: number;
  notificationPreferences: NotificationPreferences;
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
      switchMap(booking => this.scheduleNotifications(booking, request.notificationPreferences)), // ✅ Tipo correcto
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

  private scheduleNotifications(booking: Booking, preferences: NotificationPreferences): Observable<Booking> {
    const notificationObservables: Observable<boolean>[] = [];

    if (preferences.startNotification) {
      notificationObservables.push(
        this.notificationService.scheduleBookingStartNotification(
          booking.id,
          booking.scheduledStartTime
        )
      );
    }

    if (preferences.endingNotification) {
      notificationObservables.push(
        this.notificationService.scheduleBookingEndNotification(
          booking.id,
          preferences.advanceMinutes
        )
      );
    }

    // ✅ CORREGIDO: Solo 1 argumento
    if (preferences.expirationNotification) {
      notificationObservables.push(
        this.notificationService.scheduleBookingExpirationNotification?.(
          booking.id  // ✅ Solo booking.id
        ) || of(true)
      );
    }

    // Si no hay notificaciones que programar, retornar el booking directamente
    if (notificationObservables.length === 0) {
      return of(booking);
    }

    // Usar forkJoin para ejecutar todas las notificaciones en paralelo
    return forkJoin(notificationObservables).pipe(
      map(() => booking),
      catchError(error => {
        console.error('Error scheduling notifications:', error);
        return of(booking);
      })
    );
  }

  private calculateEstimatedCost(durationMinutes: number): number {
    const baseRate = 0.50; // $0.50 por minuto
    return durationMinutes * baseRate;
  }

  private generateBookingId(): string {
    return 'booking-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
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
