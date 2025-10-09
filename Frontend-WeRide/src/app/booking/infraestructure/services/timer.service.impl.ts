import { Injectable } from '@angular/core';
import { Observable, interval, of, BehaviorSubject } from 'rxjs';
import { map, takeWhile, switchMap, catchError } from 'rxjs/operators';
import { BookingTimerService } from '../../domain/services/booking-timer.service';
import { ReservationTimer, TimerWarning } from '../../domain/model/reservation-timer.entity';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class TimerServiceImpl extends BookingTimerService {
  private readonly API_URL = 'http://localhost:3000/api';
  private timers = new Map<string, BehaviorSubject<ReservationTimer>>();
  private timerIntervals = new Map<string, any>();

  constructor(private http: HttpClient) {
    super();
  }

  startTimer(bookingId: string, durationMinutes: number): Observable<ReservationTimer> {
    const timer: ReservationTimer = {
      id: this.generateTimerId(),
      bookingId,
      userId: '', // Se obtendría del contexto
      startTime: new Date(),
      endTime: new Date(Date.now() + (durationMinutes * 60000)),
      remainingMinutes: durationMinutes,
      status: 'active',
      warningThresholds: [10, 5, 1], // Advertencias en 10, 5 y 1 minutos
      extensions: [],
      autoExpire: true,
      lastUpdated: new Date()
    };

    // Guardar en el backend
    return this.http.post<ReservationTimer>(`${this.API_URL}/reservation-timers`, timer).pipe(
      switchMap(savedTimer => {
        // Iniciar el contador local
        this.startLocalTimer(savedTimer);
        return of(savedTimer);
      }),
      catchError(error => {
        console.error('Error starting timer:', error);
        return of(timer); // Fallback local
      })
    );
  }

  pauseTimer(timerId: string): Observable<boolean> {
    const timer = this.timers.get(timerId);
    if (!timer) return of(false);

    const currentTimer = timer.value;
    const updatedTimer = {
      ...currentTimer,
      status: 'paused' as const,
      lastUpdated: new Date()
    };

    return this.http.patch(`${this.API_URL}/reservation-timers/${timerId}`, updatedTimer).pipe(
      map(() => {
        timer.next(updatedTimer);
        this.stopLocalTimer(timerId);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  resumeTimer(timerId: string): Observable<boolean> {
    const timer = this.timers.get(timerId);
    if (!timer) return of(false);

    const currentTimer = timer.value;
    const updatedTimer = {
      ...currentTimer,
      status: 'active' as const,
      lastUpdated: new Date()
    };

    return this.http.patch(`${this.API_URL}/reservation-timers/${timerId}`, updatedTimer).pipe(
      map(() => {
        timer.next(updatedTimer);
        this.startLocalTimer(updatedTimer);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  extendTimer(timerId: string, additionalMinutes: number): Observable<boolean> {
    const timer = this.timers.get(timerId);
    if (!timer) return of(false);

    const currentTimer = timer.value;
    const newEndTime = new Date(currentTimer.endTime.getTime() + (additionalMinutes * 60000));

    const extension = {
      id: this.generateExtensionId(),
      extendedAt: new Date(),
      additionalMinutes,
      cost: this.calculateExtensionCost(currentTimer.remainingMinutes, additionalMinutes),
      approved: true
    };

    const updatedTimer = {
      ...currentTimer,
      endTime: newEndTime,
      extensions: [...currentTimer.extensions, extension],
      lastUpdated: new Date()
    };

    return this.http.patch(`${this.API_URL}/reservation-timers/${timerId}`, updatedTimer).pipe(
      map(() => {
        timer.next(updatedTimer);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  stopTimer(timerId: string): Observable<boolean> {
    const timer = this.timers.get(timerId);
    if (!timer) return of(false);

    const currentTimer = timer.value;
    const updatedTimer = {
      ...currentTimer,
      status: 'expired' as const,
      remainingMinutes: 0,
      lastUpdated: new Date()
    };

    return this.http.patch(`${this.API_URL}/reservation-timers/${timerId}`, updatedTimer).pipe(
      map(() => {
        timer.next(updatedTimer);
        this.stopLocalTimer(timerId);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  getTimerStatus(timerId: string): Observable<ReservationTimer> {
    const localTimer = this.timers.get(timerId);
    if (localTimer) {
      return localTimer.asObservable();
    }

    return this.http.get<ReservationTimer>(`${this.API_URL}/reservation-timers/${timerId}`).pipe(
      map(timer => {
        this.startLocalTimer(timer);
        return timer;
      })
    );
  }

  getRemainingTime(timerId: string): Observable<number> {
    return this.getTimerStatus(timerId).pipe(
      map(timer => {
        const now = new Date();
        const endTime = new Date(timer.endTime);
        const remainingMs = endTime.getTime() - now.getTime();
        return Math.max(0, Math.ceil(remainingMs / 60000)); // Minutos
      })
    );
  }

  isTimerExpired(timerId: string): Observable<boolean> {
    return this.getRemainingTime(timerId).pipe(
      map(remaining => remaining <= 0)
    );
  }

  checkForWarnings(timerId: string): Observable<TimerWarning[]> {
    return this.getRemainingTime(timerId).pipe(
      switchMap(remainingMinutes => {
        const timer = this.timers.get(timerId)?.value;
        if (!timer) return of([]);

        const warnings: TimerWarning[] = [];

        timer.warningThresholds.forEach(threshold => {
          if (remainingMinutes <= threshold && remainingMinutes > 0) {
            warnings.push({
              id: `warning-${timerId}-${threshold}`,
              timerId,
              warningMinutes: threshold,
              triggeredAt: new Date(),
              notificationSent: false
            });
          }
        });

        return of(warnings);
      })
    );
  }

  scheduleWarningNotification(timerId: string, warningMinutes: number): Observable<boolean> {
    // Esta funcionalidad se implementaría con el notification service
    console.log(`Warning notification scheduled for timer ${timerId} at ${warningMinutes} minutes`);
    return of(true);
  }

  getTimerWarnings(timerId: string): Observable<TimerWarning[]> {
    return this.http.get<TimerWarning[]>(`${this.API_URL}/timer-warnings?timerId=${timerId}`).pipe(
      catchError(() => of([]))
    );
  }

  calculateExtensionCost(currentMinutes: number, additionalMinutes: number): number {
    const baseRate = 0.50; // $0.50 por minuto
    return additionalMinutes * baseRate;
  }

  getTimerSettings(): Observable<any> {
    return of({
      warningThresholds: [10, 5, 1],
      autoExpireEnabled: true,
      maxExtensionMinutes: 120,
      baseRatePerMinute: 0.50
    });
  }

  // Métodos privados para manejo local
  private startLocalTimer(timer: ReservationTimer): void {
    if (this.timerIntervals.has(timer.id)) {
      this.stopLocalTimer(timer.id);
    }

    const subject = new BehaviorSubject<ReservationTimer>(timer);
    this.timers.set(timer.id, subject);

    const intervalId = setInterval(() => {
      const currentTimer = subject.value;
      if (currentTimer.status !== 'active') return;

      const now = new Date();
      const endTime = new Date(currentTimer.endTime);
      const remainingMs = endTime.getTime() - now.getTime();
      const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

      const updatedTimer = {
        ...currentTimer,
        remainingMinutes,
        lastUpdated: now,
        status: remainingMinutes <= 0 ? 'expired' as const : currentTimer.status
      };

      subject.next(updatedTimer);

      // Detener si ha expirado
      if (remainingMinutes <= 0) {
        this.stopLocalTimer(timer.id);
        // Notificar expiración
        this.notifyTimerExpired(timer.id);
      }
    }, 1000); // Actualizar cada segundo

    this.timerIntervals.set(timer.id, intervalId);
  }

  private stopLocalTimer(timerId: string): void {
    const intervalId = this.timerIntervals.get(timerId);
    if (intervalId) {
      clearInterval(intervalId);
      this.timerIntervals.delete(timerId);
    }
  }

  private notifyTimerExpired(timerId: string): void {
    // Aquí se integraría con el notification service
    console.log(`Timer ${timerId} has expired`);
  }

  private generateTimerId(): string {
    return 'timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  }

  private generateExtensionId(): string {
    return 'ext-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }
}
