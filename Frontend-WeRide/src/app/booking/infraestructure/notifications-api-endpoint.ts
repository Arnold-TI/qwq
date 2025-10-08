import { NotificationResponse, NotificationsListResponse } from './notifications-response';

// Servicio simulado para consumir la API de notificaciones
export class NotificationsApiEndpoint {
  private notifications: NotificationResponse[] = [];

  // Obtener todas las notificaciones
  async getAll(): Promise<NotificationsListResponse> {
    return { notifications: this.notifications };
  }

  // Crear una nueva notificación
  async create(notification: Omit<NotificationResponse, 'id' | 'sentAt'>): Promise<NotificationResponse> {
    const newNotification: NotificationResponse = {
      ...notification,
      id: Math.random().toString(36).substring(2),
      sentAt: new Date().toISOString()
    };
    this.notifications.push(newNotification);
    return newNotification;
  }

  // Obtener una notificación por ID
  async getById(id: string): Promise<NotificationResponse | undefined> {
    return this.notifications.find(n => n.id === id);
  }
}

