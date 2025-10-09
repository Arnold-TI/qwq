import { Injectable } from '@angular/core';
import { Observable, interval, Subject } from 'rxjs';
import { takeUntil, switchMap, filter, catchError } from 'rxjs/operators';
import { BookingTimerService } from '../../domain/services/booking-timer.service';
import { SendNotificationsUseCase } from '../use-cases/send-notifications.usecase';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { ReservationTimer } from '../../domain/model/reservation-timer.entity';
import { of } from 'rxjs'; // ✅ Agregar este import para el 'of([])'

export interface TimerEvent {
  type: 'warning' | 'expired' | 'extended';
  timerId: string;
  bookingId: string;
  data: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationTimerHandler {
  private destroy$ = new Subject<void>();
  private timerEvents$ = new Subject<TimerEvent>();

  constructor(
    private timerService: BookingTimerService,
    private sendNotificationsUseCase: SendNotificationsUseCase,
    private bookingRepository: BookingRepository
  ) {
    this.initializeTimerMonitoring();
  }

  // reservation-timer.handler.ts - SECCIÓN CORREGIDA
  private initializeTimerMonitoring(): void {
    interval(30000) // Cada 30 segundos
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.timerService.getActiveTimers()), // ✅ Ahora existe
        catchError((error: any) => { // ✅ Tipo explícito
          console.error('Error monitoring timers:', error);
          return of([]); // ✅ Importar 'of' de rxjs
        })
      )
      .subscribe((timers: ReservationTimer[]) => { // ✅ Tipo explícito
        timers.forEach((timer: ReservationTimer) => this.processTimer(timer)); // ✅ Tipo explícito
      });
  }

  // Procesar cada timer individual
  private processTimer(timer: ReservationTimer): void {
    // Verificar advertencias
    this.timerService.checkForWarnings(timer.id).subscribe(warnings => {
      warnings.forEach(warning => {
        if (!warning.notificationSent) {
          this.handleTimerWarning(timer, warning);
        }
      });
    });

    // Verificar expiración
    if (timer.remainingMinutes <= 0 && timer.status === 'active') {
      this.handleTimerExpiration(timer);
    }
  }

  // Manejar advertencias de timer (US-16)
  private handleTimerWarning(timer: ReservationTimer, warning: any): void {
    this.sendNotificationsUseCase.execute({
      bookingId: timer.bookingId,
      notificationType: 'booking_ending'
    }).subscribe(result => {
      if (result.success) {
        this.emitTimerEvent({
          type: 'warning',
          timerId: timer.id,
          bookingId: timer.bookingId,
          data: {
            remainingMinutes: timer.remainingMinutes,
            warningThreshold: warning.warningMinutes,
            notificationsSent: result.notificationsSent,
            actions: result.actions
          },
          timestamp: new Date()
        });

        // Marcar advertencia como enviada
        this.markWarningAsSent(warning.id);
      }
    });
  }

  // Manejar expiración de timer (US-18)
  private handleTimerExpiration(timer: ReservationTimer): void {
    // Detener el timer
    this.timerService.stopTimer(timer.id).subscribe(stopped => {
      if (stopped) {
        // Actualizar estado de la reserva
        this.bookingRepository.updateBookingStatus(timer.bookingId, 'expired').subscribe();

        // Enviar notificación de expiración
        this.sendNotificationsUseCase.execute({
          bookingId: timer.bookingId,
          notificationType: 'booking_expired'
        }).subscribe();

        // Emitir evento de expiración
        this.emitTimerEvent({
          type: 'expired',
          timerId: timer.id,
          bookingId: timer.bookingId,
          data: {
            expiredAt: new Date(),
            finalStatus: 'expired',
            autoStopped: true
          },
          timestamp: new Date()
        });

        // Liberar el vehículo automáticamente
        this.releaseVehicle(timer.bookingId);
      }
    });
  }

  // Manejar extensión de timer (US-16)
  handleTimerExtension(timerId: string, additionalMinutes: number): Observable<boolean> {
    return this.timerService.extendTimer(timerId, additionalMinutes).pipe(
      switchMap(extended => {
        if (extended) {
          // Obtener timer actualizado
          return this.timerService.getTimerStatus(timerId).pipe(
            switchMap(timer => {
              // Reprogramar notificaciones
              this.rescheduleNotifications(timer.bookingId, timer.endTime);

              // Emitir evento de extensión
              this.emitTimerEvent({
                type: 'extended',
                timerId,
                bookingId: timer.bookingId,
                data: {
                  additionalMinutes,
                  newEndTime: timer.endTime,
                  extensionCost: this.calculateExtensionCost(additionalMinutes),
                  totalExtensions: timer.extensions.length
                },
                timestamp: new Date()
              });

              return [true];
            })
          );
        }
        return [false];
      })
    );
  }

  // Pausar timer
  pauseTimer(timerId: string): Observable<boolean> {
    return this.timerService.pauseTimer(timerId);
  }

  // Reanudar timer
  resumeTimer(timerId: string): Observable<boolean> {
    return this.timerService.resumeTimer(timerId);
  }

  // Obtener eventos del timer en tiempo real
  getTimerEvents(): Observable<TimerEvent> {
    return this.timerEvents$.asObservable();
  }

  // Obtener eventos filtrados por booking
  getTimerEventsByBooking(bookingId: string): Observable<TimerEvent> {
    return this.timerEvents$.pipe(
      filter(event => event.bookingId === bookingId)
    );
  }

  // Limpiar recursos
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Métodos privados auxiliares
  private emitTimerEvent(event: TimerEvent): void {
    this.timerEvents$.next(event);
  }

  private markWarningAsSent(warningId: string): void {
    // Actualizar el estado de la advertencia en el backend
    console.log(`Marking warning ${warningId} as sent`);
  }

  private rescheduleNotifications(bookingId: string, newEndTime: Date): void {
    // Cancelar notificaciones existentes y crear nuevas
    console.log(`Rescheduling notifications for booking ${bookingId} with new end time ${newEndTime}`);
  }

  private releaseVehicle(bookingId: string): void {
    // Liberar el vehículo para que esté disponible
    this.bookingRepository.getBookingById(bookingId).subscribe(booking => {
      if (booking) {
        // Aquí se integraría con el servicio de vehículos para liberarlo
        console.log(`Releasing vehicle ${booking.vehicleId} from booking ${bookingId}`);
      }
    });
  }

  private calculateExtensionCost(minutes: number): number {
    return this.timerService.calculateExtensionCost(0, minutes);
  }
}
