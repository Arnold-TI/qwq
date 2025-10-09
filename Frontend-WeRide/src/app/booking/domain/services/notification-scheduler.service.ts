import { Observable } from 'rxjs';
import { Notification } from '../model/notification';

export abstract class NotificationSchedulerService {
  // Programación de notificaciones
  abstract scheduleBookingStartNotification(bookingId: string, scheduledTime: Date): Observable<boolean>;
  abstract scheduleBookingEndNotification(bookingId: string, minutesBefore: number): Observable<boolean>;
  abstract scheduleBookingExpirationNotification(bookingId: string): Observable<boolean>;
  abstract scheduleUnlockNotification(unlockRequestId: string): Observable<boolean>;

  // Gestión de notificaciones programadas
  abstract cancelScheduledNotifications(bookingId: string): Observable<boolean>;
  abstract updateNotificationSchedule(notificationId: string, newTime: Date): Observable<boolean>;
  abstract getScheduledNotifications(userId: string): Observable<Notification[]>;

  // Envío inmediato
  abstract sendImmediateNotification(notification: Notification): Observable<boolean>;
  abstract sendBulkNotifications(notifications: Notification[]): Observable<boolean>;

  // Reintentos y manejo de errores
  abstract retryFailedNotification(notificationId: string): Observable<boolean>;
  abstract getFailedNotifications(): Observable<Notification[]>;
  abstract markNotificationAsDelivered(notificationId: string): Observable<boolean>;
}
