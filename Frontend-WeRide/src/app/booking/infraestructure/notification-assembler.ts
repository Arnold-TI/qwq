import { Notification } from '../domain/model/notification';
import { NotificationResponse } from './notifications-response';

// Convierte NotificationResponse (infraestructura) a Notification (dominio)
export function toDomainNotification(response: NotificationResponse): Notification {
  return new Notification(
    response.id,
    response.userId,
    response.type,
    response.message,
    new Date(response.sentAt),
    response.status
  );
}

// Convierte Notification (dominio) a NotificationResponse (infraestructura)
export function toInfraNotification(notification: Notification): NotificationResponse {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    message: notification.message,
    sentAt: notification.sentAt.toISOString(),
    status: notification.status
  };
}

