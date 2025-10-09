import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { NotificationSchedulerService } from '../../domain/services/notification-scheduler.service';
import { BookingTimerService } from '../../domain/services/booking-timer.service';

export interface SendNotificationRequest {
  bookingId: string;
  notificationType: 'booking_start' | 'booking_ending' | 'booking_expired';
  userId?: string;
}

export interface SendNotificationResponse {
  success: boolean;
  notificationsSent: number;
  methods: string[];
  message: string;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  parameters?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SendNotificationsUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private notificationService: NotificationSchedulerService,
    private timerService: BookingTimerService
  ) {}

  execute(request: SendNotificationRequest): Observable<SendNotificationResponse> {
    return this.bookingRepository.getBookingById(request.bookingId).pipe(
      switchMap(booking => {
        if (!booking) {
          return throwError(() => new Error('Booking not found'));
        }

        return this.processNotification(booking, request.notificationType);
      }),
      catchError(error => this.handleNotificationError(error))
    );
  }

  private processNotification(booking: any, type: string): Observable<SendNotificationResponse> {
    switch (type) {
      case 'booking_start':
        return this.sendBookingStartNotification(booking);
      case 'booking_ending':
        return this.sendBookingEndingNotification(booking);
      case 'booking_expired':
        return this.sendBookingExpiredNotification(booking);
      default:
        return throwError(() => new Error('Unknown notification type'));
    }
  }

  // US-18: Notificación de inicio
  private sendBookingStartNotification(booking: any): Observable<SendNotificationResponse> {
    const notification = {
      id: this.generateNotificationId(),
      userId: booking.userId,
      type: 'booking_start',
      title: '🚀 ¡Tu reserva ha comenzado!',
      message: `Tu reserva del vehículo ${booking.vehicleId} está ahora activa. Puedes desbloquearlo cuando estés listo.`,
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        startTime: booking.scheduledStartTime,
        endTime: booking.scheduledEndTime
      },
      deliveryMethod: 'push', // Se expandirá según preferencias
      status: 'pending',
      createdAt: new Date(),
      actions: [
        {
          id: 'unlock-now',
          label: 'Desbloquear Ahora',
          action: 'unlock_vehicle',
          parameters: { bookingId: booking.id, method: 'app' }
        },
        {
          id: 'view-details',
          label: 'Ver Detalles',
          action: 'view_booking',
          parameters: { bookingId: booking.id }
        }
      ]
    };

    return this.sendMultiMethodNotification(notification, booking.notificationPreferences).pipe(
      map(results => ({
        success: results.some(r => r),
        notificationsSent: results.filter(r => r).length,
        methods: booking.notificationPreferences.methods,
        message: 'Notificación de inicio de reserva enviada',
        actions: notification.actions
      }))
    );
  }

  // US-16, US-18: Notificación de fin próximo
  private sendBookingEndingNotification(booking: any): Observable<SendNotificationResponse> {
    return this.timerService.getRemainingTime(booking.timer?.id).pipe(
      switchMap(remainingMinutes => {
        const extensionOptions = this.calculateExtensionOptions(remainingMinutes);

        const notification = {
          id: this.generateNotificationId(),
          userId: booking.userId,
          type: 'booking_ending',
          title: '⏰ Tu reserva termina pronto',
          message: `Faltan ${remainingMinutes} minutos para que termine tu reserva. ¿Quieres extender el tiempo?`,
          data: {
            bookingId: booking.id,
            vehicleId: booking.vehicleId,
            remainingMinutes,
            extensionOptions
          },
          deliveryMethod: 'push',
          status: 'pending',
          createdAt: new Date(),
          actions: [
            ...extensionOptions.map(option => ({
              id: `extend-${option.minutes}`,
              label: `Extender ${option.minutes} min (+$${option.cost.toFixed(2)})`,
              action: 'extend_booking',
              parameters: { bookingId: booking.id, minutes: option.minutes, cost: option.cost }
            })),
            {
              id: 'end-now',
              label: 'Terminar Ahora',
              action: 'end_booking',
              parameters: { bookingId: booking.id }
            }
          ]
        };

        return this.sendMultiMethodNotification(notification, booking.notificationPreferences).pipe(
          map(results => ({
            success: results.some(r => r),
            notificationsSent: results.filter(r => r).length,
            methods: booking.notificationPreferences.methods,
            message: `Notificación de fin de reserva enviada (${remainingMinutes} min restantes)`,
            actions: notification.actions
          }))
        );
      })
    );
  }

  // US-18: Notificación de expiración
  private sendBookingExpiredNotification(booking: any): Observable<SendNotificationResponse> {
    const notification = {
      id: this.generateNotificationId(),
      userId: booking.userId,
      type: 'booking_expired',
      title: '❌ Tu reserva ha expirado',
      message: `Tu reserva del vehículo ${booking.vehicleId} ha expirado. El vehículo se ha bloqueado automáticamente.`,
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        expiredAt: new Date(),
        finalCost: booking.finalCost
      },
      deliveryMethod: 'push',
      status: 'pending',
      createdAt: new Date(),
      actions: [
        {
          id: 'new-booking',
          label: 'Nueva Reserva',
          action: 'create_booking',
          parameters: { vehicleId: booking.vehicleId }
        },
        {
          id: 'view-history',
          label: 'Ver Historial',
          action: 'view_trip_history',
          parameters: { userId: booking.userId }
        }
      ]
    };

    return this.sendMultiMethodNotification(notification, booking.notificationPreferences).pipe(
      map(results => ({
        success: results.some(r => r),
        notificationsSent: results.filter(r => r).length,
        methods: booking.notificationPreferences.methods,
        message: 'Notificación de expiración enviada',
        actions: notification.actions
      }))
    );
  }

  private sendMultiMethodNotification(notification: any, preferences: any): Observable<boolean[]> {
    const notifications = preferences.methods.map((method: string) =>
      this.notificationService.sendImmediateNotification({
        ...notification,
        deliveryMethod: method
      })
    );

    return forkJoin(notifications);
  }

  private calculateExtensionOptions(remainingMinutes: number): any[] {
    const baseRate = 0.50; // $0.50 per minute
    const options = [15, 30, 60]; // Extension options in minutes

    return options
      .filter(minutes => minutes >= remainingMinutes) // Solo opciones mayores al tiempo restante
      .map(minutes => ({
        minutes,
        cost: minutes * baseRate
      }));
  }

  private generateNotificationId(): string {
    return 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  }

  private handleNotificationError(error: any): Observable<SendNotificationResponse> {
    return of({
      success: false,
      notificationsSent: 0,
      methods: [],
      message: 'Error al enviar notificación: ' + error.message
    });
  }
}
