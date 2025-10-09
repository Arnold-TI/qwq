import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { UnlockRequestRepository } from '../../domain/repositories/unlock-request.repository';
import { NotificationSchedulerService } from '../../domain/services/notification-scheduler.service';
import { UnlockRequest } from '../../domain/model/unlockRequest.entity';

export interface ScheduleUnlockRequest {
  bookingId: string;
  userId: string;
  scheduledTime: Date;
  notifyMinutesBefore?: number; // Default 10 minutos
  autoUnlock?: boolean; // Default true
}

export interface ScheduleUnlockResponse {
  success: boolean;
  unlockRequestId?: string;
  scheduledTime?: Date;
  notificationScheduled?: boolean;
  message: string;
  errorCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleUnlockUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private unlockRequestRepository: UnlockRequestRepository,
    private notificationService: NotificationSchedulerService
  ) {}

  execute(request: ScheduleUnlockRequest): Observable<ScheduleUnlockResponse> {
    return this.validateScheduleRequest(request).pipe(
      switchMap(booking => this.createScheduledUnlock(request, booking)),
      switchMap(unlockRequest => this.scheduleNotification(unlockRequest, request)),
      catchError(error => this.handleScheduleError(error))
    );
  }

  private validateScheduleRequest(request: ScheduleUnlockRequest): Observable<any> {
    // Validaciones específicas US-22
    const now = new Date();
    const scheduledTime = new Date(request.scheduledTime);

    if (scheduledTime <= now) {
      return throwError(() => new Error('La hora programada debe ser futura'));
    }

    const maxAdvanceHours = 24; // Máximo 24 horas de anticipación
    const maxFutureTime = new Date(now.getTime() + (maxAdvanceHours * 60 * 60 * 1000));

    if (scheduledTime > maxFutureTime) {
      return throwError(() => new Error('No se puede programar con más de 24 horas de anticipación'));
    }

    return this.bookingRepository.getBookingById(request.bookingId).pipe(
      switchMap(booking => {
        if (!booking) {
          return throwError(() => new Error('Reserva no encontrada'));
        }

        if (booking.userId !== request.userId) {
          return throwError(() => new Error('No autorizado para esta reserva'));
        }

        if (booking.status !== 'confirmed') {
          return throwError(() => new Error('La reserva debe estar confirmada para programar desbloqueo'));
        }

        // Verificar que la hora programada esté dentro del período de la reserva
        const bookingStart = new Date(booking.scheduledStartTime);
        const bookingEnd = new Date(booking.scheduledEndTime);

        if (scheduledTime < bookingStart || scheduledTime > bookingEnd) {
          return throwError(() => new Error('La hora programada debe estar dentro del período de la reserva'));
        }

        // Verificar si ya existe un desbloqueo programado
        return this.unlockRequestRepository.getUnlockRequestsByBookingId(booking.id).pipe(
          map(existingRequests => {
            const scheduledRequest = existingRequests.find(req =>
              req.method === 'scheduled' &&
              (req.status === 'pending' || req.status === 'processing')
            );

            if (scheduledRequest) {
              throw new Error('Ya existe un desbloqueo programado para esta reserva');
            }

            return booking;
          })
        );
      })
    );
  }

  private createScheduledUnlock(request: ScheduleUnlockRequest, booking: any): Observable<UnlockRequest> {
    const unlockRequest: UnlockRequest = {
      id: this.generateScheduledUnlockId(),
      bookingId: request.bookingId,
      vehicleId: booking.vehicleId,
      userId: request.userId,
      method: 'scheduled',
      status: 'pending',
      requestedAt: new Date(),
      scheduledFor: new Date(request.scheduledTime),
      expiresAt: new Date(request.scheduledTime.getTime() + (30 * 60 * 1000)), // Expira 30 min después
      requestLocation: { lat: 0, lng: 0 }, // Se actualizará cuando se ejecute
      vehicleLocation: { lat: 0, lng: 0 }, // Se obtiene del servicio
      distanceValidation: false,
      maxDistanceMeters: 100,
      retryCount: 0,
      maxRetries: 3,
      vehicleConnectionStatus: 'online',
      attemptLogs: []
    };

    return this.unlockRequestRepository.createUnlockRequest(unlockRequest);
  }

  private scheduleNotification(
    unlockRequest: UnlockRequest,
    request: ScheduleUnlockRequest
  ): Observable<ScheduleUnlockResponse> {
    const notifyMinutes = request.notifyMinutesBefore || 10;
    const notificationTime = new Date(
      unlockRequest.scheduledFor!.getTime() - (notifyMinutes * 60 * 1000)
    );

    // Solo programar notificación si es en el futuro
    const shouldNotify = notificationTime > new Date();

    if (!shouldNotify) {
      return of({
        success: true,
        unlockRequestId: unlockRequest.id,
        scheduledTime: unlockRequest.scheduledFor,
        notificationScheduled: false,
        message: `Desbloqueo programado exitosamente para ${this.formatTime(unlockRequest.scheduledFor!)}`
      });
    }

    return this.notificationService.scheduleUnlockNotification(unlockRequest.id).pipe(
      map(notificationScheduled => ({
        success: true,
        unlockRequestId: unlockRequest.id,
        scheduledTime: unlockRequest.scheduledFor,
        notificationScheduled,
        message: notificationScheduled
          ? `Desbloqueo programado para ${this.formatTime(unlockRequest.scheduledFor!)}. Te notificaremos ${notifyMinutes} minutos antes.`
          : `Desbloqueo programado para ${this.formatTime(unlockRequest.scheduledFor!)}`
      })),
      catchError(notificationError => {
        // Si falla la notificación, el unlock programado sigue siendo válido
        console.warn('Error scheduling notification:', notificationError);
        return of({
          success: true,
          unlockRequestId: unlockRequest.id,
          scheduledTime: unlockRequest.scheduledFor,
          notificationScheduled: false,
          message: `Desbloqueo programado para ${this.formatTime(unlockRequest.scheduledFor!)} (sin notificación)`
        });
      })
    );
  }

  private generateScheduledUnlockId(): string {
    return 'unlock-scheduled-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  }

  private formatTime(date: Date): string {
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private handleScheduleError(error: any): Observable<ScheduleUnlockResponse> {
    let message = 'Error al programar el desbloqueo';
    let errorCode = 'SCHEDULE_ERROR';

    if (error.message.includes('futura')) {
      message = 'La hora programada debe ser futura';
      errorCode = 'INVALID_TIME';
    } else if (error.message.includes('24 horas')) {
      message = 'No se puede programar con más de 24 horas de anticipación';
      errorCode = 'TOO_ADVANCE';
    } else if (error.message.includes('no encontrada')) {
      message = 'Reserva no encontrada';
      errorCode = 'BOOKING_NOT_FOUND';
    } else if (error.message.includes('confirmada')) {
      message = 'La reserva debe estar confirmada para programar desbloqueo';
      errorCode = 'INVALID_BOOKING_STATUS';
    } else if (error.message.includes('período de la reserva')) {
      message = 'La hora programada debe estar dentro del período de la reserva';
      errorCode = 'TIME_OUT_OF_RANGE';
    } else if (error.message.includes('ya existe')) {
      message = 'Ya tienes un desbloqueo programado para esta reserva';
      errorCode = 'ALREADY_SCHEDULED';
    } else if (error.message.includes('disponible')) {
      message = 'El vehículo no estará disponible en la hora seleccionada';
      errorCode = 'VEHICLE_NOT_AVAILABLE';
    }

    return of({
      success: false,
      message,
      errorCode
    });
  }
}
