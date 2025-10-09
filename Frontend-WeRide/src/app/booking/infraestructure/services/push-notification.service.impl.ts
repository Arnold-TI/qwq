import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';
import { NotificationSchedulerService } from '../../domain/services/notification-scheduler.service';
import { Notification } from '../../domain/model/notification';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationServiceImpl extends NotificationSchedulerService {
  private readonly API_URL = 'http://localhost:3000/api';
  private scheduledNotifications = new Map<string, any>();

  constructor(private http: HttpClient) {
    super();
  }

  scheduleBookingStartNotification(bookingId: string, scheduledTime: Date): Observable<boolean> {
    const notification: Notification = {
      id: this.generateNotificationId(),
      userId: '', // Se obtendría del booking
      type: 'booking_start',
      title: '🚀 ¡Tu reserva ha comenzado!',
      message: 'Puedes desbloquear tu vehículo ahora',
      category: 'booking',
      priority: 'normal',
      createdAt: new Date(),
      scheduledFor: scheduledTime,
      data: { bookingId },
      deliveryMethod: 'push',
      status: 'scheduled',
      isRead: false,
      actionRequired: false
    };

    return this.scheduleNotification(notification);
  }

  scheduleBookingEndNotification(bookingId: string, minutesBefore: number): Observable<boolean> {
    // Obtener el booking para calcular la hora de notificación
    return this.http.get<any>(`${this.API_URL}/bookings/${bookingId}`).pipe(
      switchMap(booking => {
        const endTime = new Date(booking.scheduledEndTime);
        const notificationTime = new Date(endTime.getTime() - (minutesBefore * 60000));

        const notification: Notification = {
          id: this.generateNotificationId(),
          userId: booking.userId,
          type: 'booking_ending',
          title: '⏰ Tu reserva termina pronto',
          message: `Faltan ${minutesBefore} minutos para que termine tu reserva`,
          category: 'booking',
          priority: 'high',
          createdAt: new Date(),
          scheduledFor: notificationTime,
          data: {
            bookingId,
            remainingMinutes: minutesBefore,
            extensionOptions: [
              { minutes: 15, cost: 7.50 },
              { minutes: 30, cost: 15.00 },
              { minutes: 60, cost: 28.00 }
            ]
          },
          deliveryMethod: 'push',
          status: 'scheduled',
          isRead: false,
          actionRequired: true,
          actions: [
            {
              id: 'extend-15',
              label: 'Extender 15 min (+$7.50)',
              action: 'extend_booking',
              parameters: { bookingId, minutes: 15 }
            },
            {
              id: 'extend-30',
              label: 'Extender 30 min (+$15.00)',
              action: 'extend_booking',
              parameters: { bookingId, minutes: 30 }
            }
          ]
        };

        return this.scheduleNotification(notification);
      }),
      catchError(error => {
        console.error('Error scheduling booking end notification:', error);
        return of(false);
      })
    );
  }

  scheduleBookingExpirationNotification(bookingId: string): Observable<boolean> {
    return this.http.get<any>(`${this.API_URL}/bookings/${bookingId}`).pipe(
      switchMap(booking => {
        const notification: Notification = {
          id: this.generateNotificationId(),
          userId: booking.userId,
          type: 'booking_expired',
          title: '❌ Tu reserva ha expirado',
          message: 'El vehículo se ha bloqueado automáticamente',
          category: 'booking',
          priority: 'high',
          createdAt: new Date(),
          scheduledFor: new Date(booking.scheduledEndTime),
          data: { bookingId },
          deliveryMethod: 'push',
          status: 'scheduled',
          isRead: false,
          actionRequired: false
        };

        return this.scheduleNotification(notification);
      }),
      catchError(() => of(false))
    );
  }

  scheduleUnlockNotification(unlockRequestId: string): Observable<boolean> {
    return this.http.get<any>(`${this.API_URL}/unlock-requests/${unlockRequestId}`).pipe(
      switchMap(unlockRequest => {
        if (!unlockRequest.scheduledFor) return of(false);

        const notificationTime = new Date(
          new Date(unlockRequest.scheduledFor).getTime() - (10 * 60000) // 10 min antes
        );

        const notification: Notification = {
          id: this.generateNotificationId(),
          userId: unlockRequest.userId,
          type: 'unlock_scheduled',
          title: '🔓 Desbloqueo programado próximo',
          message: 'Tu vehículo se desbloqueará automáticamente en 10 minutos',
          category: 'unlock',
          priority: 'normal',
          createdAt: new Date(),
          scheduledFor: notificationTime,
          data: { unlockRequestId, vehicleId: unlockRequest.vehicleId },
          deliveryMethod: 'push',
          status: 'scheduled',
          isRead: false,
          actionRequired: false
        };

        return this.scheduleNotification(notification);
      }),
      catchError(() => of(false))
    );
  }

  cancelScheduledNotifications(bookingId: string): Observable<boolean> {
    return this.http.get<Notification[]>(`${this.API_URL}/notifications?data.bookingId=${bookingId}&status=scheduled`).pipe(
      switchMap(notifications => {
        const cancelPromises = notifications.map(notification =>
          this.http.patch(`${this.API_URL}/notifications/${notification.id}`, { status: 'cancelled' })
        );

        // Cancelar también los timers locales
        notifications.forEach(notification => {
          this.cancelLocalScheduledNotification(notification.id);
        });

        return cancelPromises.length > 0 ?
          forkJoin(cancelPromises).pipe(map(() => true)) :
          of(true);
      }),
      catchError(() => of(false))
    );
  }

  updateNotificationSchedule(notificationId: string, newTime: Date): Observable<boolean> {
    return this.http.patch(`${this.API_URL}/notifications/${notificationId}`, {
      scheduledFor: newTime.toISOString(),
      status: 'scheduled'
    }).pipe(
      map(() => {
        // Reprogramar el timer local
        this.rescheduleLocalNotification(notificationId, newTime);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  getScheduledNotifications(userId: string): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.API_URL}/notifications?userId=${userId}&status=scheduled`).pipe(
      catchError(() => of([]))
    );
  }

  sendImmediateNotification(notification: Notification): Observable<boolean> {
    // Simular envío de notificación push
    return this.http.post(`${this.API_URL}/notifications`, {
      ...notification,
      status: 'sent',
      sentAt: new Date().toISOString()
    }).pipe(
      switchMap(() => this.deliverNotification(notification)),
      map(() => true),
      catchError(error => {
        console.error('Failed to send immediate notification:', error);
        return of(false);
      })
    );
  }

  sendBulkNotifications(notifications: Notification[]): Observable<boolean> {
    const sendPromises = notifications.map(notification =>
      this.sendImmediateNotification(notification)
    );

    return forkJoin(sendPromises).pipe(
      map(results => results.every(result => result)),
      catchError(() => of(false))
    );
  }

  retryFailedNotification(notificationId: string): Observable<boolean> {
    return this.http.get<Notification>(`${this.API_URL}/notifications/${notificationId}`).pipe(
      switchMap(notification => {
        if (notification.status !== 'failed') return of(false);

        const retryNotification = {
          ...notification,
          status: 'pending',
          retryCount: (notification.retryCount || 0) + 1,
          lastRetryAt: new Date().toISOString()
        };

        return this.sendImmediateNotification(retryNotification);
      }),
      catchError(() => of(false))
    );
  }

  getFailedNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.API_URL}/notifications?status=failed`).pipe(
      catchError(() => of([]))
    );
  }

  markNotificationAsDelivered(notificationId: string): Observable<boolean> {
    return this.http.patch(`${this.API_URL}/notifications/${notificationId}`, {
      status: 'delivered',
      deliveredAt: new Date().toISOString()
    }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // Métodos privados para manejo local de notificaciones programadas
  private scheduleNotification(notification: Notification): Observable<boolean> {
    return this.http.post<Notification>(`${this.API_URL}/notifications`, notification).pipe(
      map(savedNotification => {
        // Programar localmente si es para el futuro
        if (savedNotification.scheduledFor && new Date(savedNotification.scheduledFor) > new Date()) {
          this.scheduleLocalNotification(savedNotification);
        }
        return true;
      }),
      catchError(() => of(false))
    );
  }

  private scheduleLocalNotification(notification: Notification): void {
    if (!notification.scheduledFor) return;

    const delay = new Date(notification.scheduledFor).getTime() - Date.now();

    if (delay > 0) {
      const timeoutId = setTimeout(() => {
        this.deliverNotification(notification);
        this.scheduledNotifications.delete(notification.id);
      }, delay);

      this.scheduledNotifications.set(notification.id, timeoutId);
    }
  }

  private cancelLocalScheduledNotification(notificationId: string): void {
    const timeoutId = this.scheduledNotifications.get(notificationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledNotifications.delete(notificationId);
    }
  }

  private rescheduleLocalNotification(notificationId: string, newTime: Date): void {
    this.cancelLocalScheduledNotification(notificationId);

    // Obtener la notificación actualizada y reprogramar
    this.http.get<Notification>(`${this.API_URL}/notifications/${notificationId}`).subscribe(
      notification => this.scheduleLocalNotification(notification)
    );
  }

  private deliverNotification(notification: Notification): Observable<boolean> {
    // Simular diferentes métodos de entrega
    switch (notification.deliveryMethod) {
      case 'push':
        return this.deliverPushNotification(notification);
      case 'sms':
        return this.deliverSMSNotification(notification);
      case 'email':
        return this.deliverEmailNotification(notification);
      default:
        return this.deliverPushNotification(notification);
    }
  }

  private deliverPushNotification(notification: Notification): Observable<boolean> {
    // Simular entrega de notificación push
    console.log('🔔 Push Notification:', notification.title, notification.message);

    // En un entorno real, aquí usarías el Service Worker o Firebase Cloud Messaging
    if ('Notification' in window && Notification.permission === 'granted') {
      const options = {
        body: notification.message,
        icon: '/assets/icons/weride-icon.png',
        badge: '/assets/icons/weride-badge.png',
        data: notification.data,
        actions: notification.actions?.map(action => ({
          action: action.id,
          title: action.label
        })) || []
      };

      new Notification(notification.title, options);
    }

    return of(true).pipe(delay(100)); // Simular latencia de red
  }

  private deliverSMSNotification(notification: Notification): Observable<boolean> {
    console.log('📱 SMS Notification:', notification.message);
    // Aquí integrarías con un servicio SMS como Twilio
    return of(true).pipe(delay(200));
  }

  private deliverEmailNotification(notification: Notification): Observable<boolean> {
    console.log('📧 Email Notification:', notification.title);
    // Aquí integrarías con un servicio de email
    return of(true).pipe(delay(300));
  }

  private generateNotificationId(): string {
    return 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  }
}

// Importar forkJoin
import { forkJoin } from 'rxjs';
