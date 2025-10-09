export interface Notification {
  id: string;
  userId: string;
  type: 'booking_start' | 'booking_ending' | 'booking_expired' | 'unlock_scheduled' | 'general';
  title: string;
  message: string;
  category: 'booking' | 'unlock' | 'general';
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  sentAt?: Date;
  scheduledFor?: Date;
  status: 'scheduled' | 'sent' | 'pending' | 'failed' | 'delivered' | 'cancelled';
  deliveryMethod: 'sms' | 'email' | 'push';
  data?: any;
  isRead: boolean;
  actionRequired: boolean;
  actions?: NotificationAction[];
  retryCount?: number;
  lastRetryAt?: Date;
  deliveredAt?: Date;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  parameters?: any;
}
