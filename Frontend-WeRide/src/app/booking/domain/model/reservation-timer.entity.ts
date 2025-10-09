export interface ReservationTimer {
  id: string;
  bookingId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  remainingMinutes: number;
  status: 'active' | 'paused' | 'expired' | 'extended';
  warningThresholds: number[]; // [10, 5, 1] minutos para notificaciones
  extensions: TimerExtension[];
  autoExpire: boolean;
  lastUpdated: Date;
}

export interface TimerExtension {
  id: string;
  extendedAt: Date;
  additionalMinutes: number;
  cost: number;
  approved: boolean;
  paymentId?: string;
}

export interface TimerWarning {
  id: string;
  timerId: string;
  warningMinutes: number;
  triggeredAt: Date;
  notificationSent: boolean;
  userResponse?: 'extend' | 'ignore' | 'end_early';
}
