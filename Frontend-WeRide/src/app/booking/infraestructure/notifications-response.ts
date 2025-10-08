// Respuesta de la API para una notificación
export interface NotificationResponse {
  id: string;
  userId: string;
  type: 'sms' | 'email' | 'push';
  message: string;
  sentAt: string;
  status: 'sent' | 'pending' | 'failed';
}

// Respuesta de la API para listado de notificaciones
export interface NotificationsListResponse {
  notifications: NotificationResponse[];
}

