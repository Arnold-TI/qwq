import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ExtendReservationUseCase } from '../use-cases/extend-reservation.usecase';
import { UnlockFromAppUseCase } from '../use-cases/unlock-from-app.usecase';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { Router } from '@angular/router';

export interface NotificationActionRequest {
  actionId: string;
  actionType: string;
  userId: string;
  notificationId: string;
  parameters: any;
}

export interface NotificationActionResponse {
  success: boolean;
  message: string;
  redirectTo?: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationActionHandler {

  constructor(
    private extendReservationUseCase: ExtendReservationUseCase,
    private unlockFromAppUseCase: UnlockFromAppUseCase,
    private bookingRepository: BookingRepository,
    private router: Router
  ) {}

  // Manejar acción desde notificación
  handleAction(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    switch (request.actionType) {
      case 'extend_booking':
        return this.handleExtendBooking(request);

      case 'unlock_vehicle':
        return this.handleUnlockVehicle(request);

      case 'view_booking':
        return this.handleViewBooking(request);

      case 'end_booking':
        return this.handleEndBooking(request);

      case 'create_booking':
        return this.handleCreateBooking(request);

      case 'view_trip_history':
        return this.handleViewTripHistory(request);

      case 'retry_unlock':
        return this.handleRetryUnlock(request);

      default:
        return of({
          success: false,
          message: `Acción no reconocida: ${request.actionType}`
        });
    }
  }

  // US-16: Extender reserva desde notificación
  private handleExtendBooking(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    const { bookingId, minutes, cost } = request.parameters;

    return this.extendReservationUseCase.execute({
      bookingId,
      userId: request.userId,
      additionalMinutes: minutes
    }).pipe(
      switchMap(result => {
        if (result.success) {
          return of({
            success: true,
            message: `Reserva extendida por ${minutes} minutos (+$${cost.toFixed(2)})`,
            data: {
              newEndTime: result.newEndTime,
              additionalCost: result.additionalCost,
              extensionId: result.extension?.id
            }
          });
        } else {
          return of({
            success: false,
            message: result.message
          });
        }
      }),
      catchError(error => of({
        success: false,
        message: 'Error al extender la reserva: ' + error.message
      }))
    );
  }

  // US-20: Desbloquear vehículo desde notificación
  private handleUnlockVehicle(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    const { bookingId, method } = request.parameters;

    return this.unlockFromAppUseCase.execute({
      bookingId,
      userId: request.userId
    }).pipe(
      switchMap(result => {
        if (result.success) {
          return of({
            success: true,
            message: 'Vehículo desbloqueado exitosamente',
            redirectTo: '/booking/unlock-status',
            data: {
              unlockRequestId: result.unlockRequestId
            }
          });
        } else {
          return of({
            success: false,
            message: result.message
          });
        }
      }),
      catchError(error => of({
        success: false,
        message: 'Error al desbloquear: ' + error.message
      }))
    );
  }

  // Ver detalles de la reserva
  private handleViewBooking(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    const { bookingId } = request.parameters;

    return of({
      success: true,
      message: 'Redirigiendo a detalles de la reserva',
      redirectTo: `/booking/details/${bookingId}`
    });
  }

  // Terminar reserva anticipadamente
  private handleEndBooking(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    const { bookingId } = request.parameters;

    return this.bookingRepository.updateBookingStatus(bookingId, 'completed').pipe(
      switchMap(updated => {
        if (updated) {
          return of({
            success: true,
            message: 'Reserva terminada exitosamente',
            redirectTo: '/booking/summary',
            data: { bookingId }
          });
        } else {
          return of({
            success: false,
            message: 'No se pudo terminar la reserva'
          });
        }
      }),
      catchError(error => of({
        success: false,
        message: 'Error al terminar la reserva: ' + error.message
      }))
    );
  }

  // Crear nueva reserva
  private handleCreateBooking(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    const { vehicleId } = request.parameters;

    return of({
      success: true,
      message: 'Redirigiendo a nueva reserva',
      redirectTo: `/booking/create?vehicleId=${vehicleId}`
    });
  }

  // Ver historial de viajes
  private handleViewTripHistory(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    return of({
      success: true,
      message: 'Redirigiendo al historial',
      redirectTo: '/trip/history'
    });
  }

  // Reintentar desbloqueo fallido
  private handleRetryUnlock(request: NotificationActionRequest): Observable<NotificationActionResponse> {
    const { unlockRequestId } = request.parameters;

    // Aquí integrarías con el servicio de desbloqueo para reintentar
    return of({
      success: true,
      message: 'Reintentando desbloqueo...',
      redirectTo: '/booking/unlock-status',
      data: { unlockRequestId }
    });
  }

  // Ejecutar redirección si es necesaria
  executeRedirection(response: NotificationActionResponse): void {
    if (response.redirectTo) {
      setTimeout(() => {
        this.router.navigate([response.redirectTo]);
      }, 1000); // Delay de 1 segundo para mostrar mensaje
    }
  }

  // Marcar notificación como procesada
  markNotificationAsProcessed(notificationId: string): Observable<boolean> {
    // Aquí actualizarías el estado de la notificación en el backend
    console.log(`Marking notification ${notificationId} as processed`);
    return of(true);
  }

  // Obtener acciones disponibles para una notificación
  getAvailableActions(notificationType: string, data: any): string[] {
    switch (notificationType) {
      case 'booking_ending':
        return ['extend_booking', 'end_booking', 'view_booking'];

      case 'booking_start':
        return ['unlock_vehicle', 'view_booking'];

      case 'booking_expired':
        return ['create_booking', 'view_trip_history'];

      case 'unlock_failed':
        return ['retry_unlock', 'view_booking'];

      default:
        return ['view_booking'];
    }
  }

  // Validar si una acción es válida para el contexto
  isActionValid(actionType: string, userId: string, parameters: any): Observable<boolean> {
    switch (actionType) {
      case 'extend_booking':
        return this.validateExtendBookingAction(parameters.bookingId, userId);

      case 'unlock_vehicle':
        return this.validateUnlockAction(parameters.bookingId, userId);

      default:
        return of(true); // Acciones simples como view siempre son válidas
    }
  }

  private validateExtendBookingAction(bookingId: string, userId: string): Observable<boolean> {
    return this.bookingRepository.getBookingById(bookingId).pipe(
      switchMap(booking => {
        if (!booking) return of(false);
        if (booking.userId !== userId) return of(false);
        if (booking.status !== 'active') return of(false);
        if (!booking.allowExtensions) return of(false);

        return of(true);
      }),
      catchError(() => of(false))
    );
  }

  private validateUnlockAction(bookingId: string, userId: string): Observable<boolean> {
    return this.bookingRepository.getBookingById(bookingId).pipe(
      switchMap(booking => {
        if (!booking) return of(false);
        if (booking.userId !== userId) return of(false);
        if (booking.status !== 'active' && booking.status !== 'confirmed') return of(false);

        return of(true);
      }),
      catchError(() => of(false))
    );
  }
}
