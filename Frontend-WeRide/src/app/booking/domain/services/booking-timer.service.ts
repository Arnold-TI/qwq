import { Observable } from 'rxjs';
import { ReservationTimer, TimerWarning } from '../model/reservation-timer.entity';

export abstract class BookingTimerService {
  // Control del timer
  abstract startTimer(bookingId: string, durationMinutes: number): Observable<ReservationTimer>;
  abstract pauseTimer(timerId: string): Observable<boolean>;
  abstract resumeTimer(timerId: string): Observable<boolean>;
  abstract extendTimer(timerId: string, additionalMinutes: number): Observable<boolean>;
  abstract stopTimer(timerId: string): Observable<boolean>;

  // Monitoreo del timer
  abstract getTimerStatus(timerId: string): Observable<ReservationTimer>;
  abstract getRemainingTime(timerId: string): Observable<number>; // minutos
  abstract isTimerExpired(timerId: string): Observable<boolean>;

  // Advertencias y notificaciones
  abstract checkForWarnings(timerId: string): Observable<TimerWarning[]>;
  abstract scheduleWarningNotification(timerId: string, warningMinutes: number): Observable<boolean>;
  abstract getTimerWarnings(timerId: string): Observable<TimerWarning[]>;

  // Utilidades
  abstract calculateExtensionCost(currentMinutes: number, additionalMinutes: number): number;
  abstract getTimerSettings(): Observable<any>;
}
