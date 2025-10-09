import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { BookingTimerService } from '../../domain/services/booking-timer.service';
import { NotificationSchedulerService } from '../../domain/services/notification-scheduler.service';
import { BookingExtension } from '../../domain/model/booking.entity';

export interface ExtendReservationRequest {
  bookingId: string;
  userId: string;
  additionalMinutes: number;
  paymentMethodId?: string;
}

export interface ExtendReservationResponse {
  success: boolean;
  extension?: BookingExtension;
  newEndTime?: Date;
  additionalCost?: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExtendReservationUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private timerService: BookingTimerService,
    private notificationService: NotificationSchedulerService
  ) {}

  execute(request: ExtendReservationRequest): Observable<ExtendReservationResponse> {
    return this.validateExtensionRequest(request).pipe(
      switchMap(booking => this.processExtension(booking, request)),
      switchMap(result => this.updateTimer(result)),
      switchMap(result => this.rescheduleNotifications(result)),
      catchError(error => this.handleExtensionError(error))
    );
  }

  private validateExtensionRequest(request: ExtendReservationRequest): Observable<any> {
    return this.bookingRepository.getBookingById(request.bookingId).pipe(
      map(booking => {
        // Validaciones específicas US-16
        if (!booking) {
          throw new Error('Booking not found');
        }

        if (booking.userId !== request.userId) {
          throw new Error('Unauthorized');
        }

        if (booking.status !== 'active') {
          throw new Error('Booking not active');
        }

        if (!booking.allowExtensions) {
          throw new Error('Extensions not allowed');
        }

        if (request.additionalMinutes > booking.maxExtensionMinutes) {
          throw new Error('Extension exceeds maximum allowed');
        }

        const totalExtensionMinutes = booking.extensions
          .filter(ext => ext.approved)
          .reduce((total, ext) => total + ext.additionalMinutes, 0);

        if (totalExtensionMinutes + request.additionalMinutes > booking.maxExtensionMinutes) {
          throw new Error('Total extensions exceed maximum allowed');
        }

        return booking;
      })
    );
  }

  private processExtension(booking: any, request: ExtendReservationRequest): Observable<any> {
    const additionalCost = this.timerService.calculateExtensionCost(
      this.getRemainingMinutes(booking),
      request.additionalMinutes
    );

    const extension: BookingExtension = {
      id: this.generateExtensionId(),
      requestedAt: new Date(),
      additionalMinutes: request.additionalMinutes,
      cost: additionalCost,
      approved: true, // En producción, esto dependería del pago
      paymentProcessed: true // En producción, procesar pago real
    };

    return this.bookingRepository.extendBooking(booking.id, extension).pipe(
      map(success => {
        if (!success) {
          throw new Error('Failed to extend booking');
        }

        return {
          booking,
          extension,
          additionalCost,
          newEndTime: new Date(booking.scheduledEndTime.getTime() + (request.additionalMinutes * 60000))
        };
      })
    );
  }

  private updateTimer(result: any): Observable<any> {
    if (!result.booking.timer) {
      return of(result);
    }

    return this.timerService.extendTimer(
      result.booking.timer.id,
      result.extension.additionalMinutes
    ).pipe(
      map(success => {
        if (!success) {
          throw new Error('Failed to extend timer');
        }
        return result;
      })
    );
  }

  private rescheduleNotifications(result: any): Observable<ExtendReservationResponse> {
    // Cancelar notificaciones existentes y reprogramar
    return this.notificationService.cancelScheduledNotifications(result.booking.id).pipe(
      switchMap(() =>
        this.notificationService.scheduleBookingEndNotification(
          result.booking.id,
          result.booking.notificationPreferences.advanceMinutes
        )
      ),
      map(() => ({
        success: true,
        extension: result.extension,
        newEndTime: result.newEndTime,
        additionalCost: result.additionalCost,
        message: `Reserva extendida por ${result.extension.additionalMinutes} minutos`
      }))
    );
  }

  private getRemainingMinutes(booking: any): number {
    const now = new Date();
    const endTime = new Date(booking.scheduledEndTime);
    return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 60000));
  }

  private generateExtensionId(): string {
    return 'ext-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  private handleExtensionError(error: any): Observable<ExtendReservationResponse> {
    let message = 'Error al extender la reserva';

    if (error.message.includes('not found')) {
      message = 'Reserva no encontrada';
    } else if (error.message.includes('not active')) {
      message = 'La reserva no está activa';
    } else if (error.message.includes('not allowed')) {
      message = 'Las extensiones no están permitidas para esta reserva';
    } else if (error.message.includes('exceeds maximum')) {
      message = 'La extensión excede el tiempo máximo permitido';
    } else if (error.message.includes('connection')) {
      message = 'Error de conexión. Intenta de nuevo';
    }

    return of({
      success: false,
      message
    });
  }
}
