import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, interval, takeUntil, switchMap } from 'rxjs';
import { ExtendReservationUseCase } from '../../../application/use-cases/extend-reservation.usecase';
import { SendNotificationsUseCase } from '../../../application/use-cases/send-notifications.usecase';
import { BookingRepository } from '../../../domain/repositories/booking.repository';

interface TimerState {
  bookingId: string;
  remainingMinutes: number;
  remainingSeconds: number;
  totalMinutes: number;
  status: 'active' | 'warning' | 'critical' | 'expired';
  canExtend: boolean;
}

interface ExtensionOption {
  minutes: number;
  cost: number;
  label: string;
}

@Component({
  selector: 'app-reservation-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-timer.component.html',
  styleUrl: './reservation-timer.component.css'
})
export class ReservationTimerComponent implements OnInit, OnDestroy {
  @Input() bookingId: string = '';
  @Input() autoStart: boolean = true;

  private destroy$ = new Subject<void>();
  private readonly WARNING_THRESHOLD = 10; // minutos
  private readonly CRITICAL_THRESHOLD = 5; // minutos
  private lastNotificationMinute = -1; // Para evitar notificaciones duplicadas

  timerState: TimerState = {
    bookingId: '',
    remainingMinutes: 0,
    remainingSeconds: 0,
    totalMinutes: 60,
    status: 'active',
    canExtend: true
  };

  extensionOptions: ExtensionOption[] = [
    { minutes: 15, cost: 7.50, label: '15 min' },
    { minutes: 30, cost: 15.00, label: '30 min' },
    { minutes: 60, cost: 28.00, label: '1 hora' }
  ];

  isLoading = false;
  isExtending = false;
  showExtensionModal = false;
  selectedExtension: ExtensionOption | null = null;
  extensionMessage = '';
  errorMessage = '';
  warningMessage = '';

  // Mock user data - en producción vendría del contexto de autenticación
  private currentUserId = 'user-123';

  constructor(
    private extendReservationUseCase: ExtendReservationUseCase,
    private sendNotificationsUseCase: SendNotificationsUseCase,
    private bookingRepository: BookingRepository,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.bookingId && this.autoStart) {
      this.startTimer();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startTimer(): void {
    if (!this.bookingId) {
      this.errorMessage = 'ID de reserva no proporcionado';
      return;
    }

    this.isLoading = true;
    this.timerState.bookingId = this.bookingId;

    // Obtener información inicial de la reserva
    this.bookingRepository.getBookingById(this.bookingId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (booking) => {
        this.initializeTimer(booking);
        this.startCountdown();
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar la reserva: ' + error.message;
        this.isLoading = false;
      }
    });
  }

  private initializeTimer(booking: any): void {
    const now = new Date();
    const endTime = new Date(booking.scheduledEndTime);
    const totalMs = endTime.getTime() - new Date(booking.scheduledStartTime).getTime();
    const remainingMs = Math.max(0, endTime.getTime() - now.getTime());

    this.timerState = {
      ...this.timerState,
      totalMinutes: Math.ceil(totalMs / 60000),
      remainingMinutes: Math.floor(remainingMs / 60000),
      remainingSeconds: Math.floor((remainingMs % 60000) / 1000),
      canExtend: booking.allowExtensions && booking.status === 'active'
    };

    this.updateTimerStatus();
    this.isLoading = false;
  }

  private startCountdown(): void {
    interval(1000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateTimer();
    });
  }

  private updateTimer(): void {
    if (this.timerState.remainingSeconds > 0) {
      this.timerState.remainingSeconds--;
    } else if (this.timerState.remainingMinutes > 0) {
      this.timerState.remainingMinutes--;
      this.timerState.remainingSeconds = 59;
    } else {
      // Timer expirado
      this.handleTimerExpired();
      return;
    }

    this.updateTimerStatus();
    this.checkForNotifications();
  }

  private updateTimerStatus(): void {
    const remainingMinutes = this.timerState.remainingMinutes;

    if (remainingMinutes <= 0) {
      this.timerState.status = 'expired';
      this.warningMessage = 'Tu reserva ha expirado';
    } else if (remainingMinutes <= this.CRITICAL_THRESHOLD) {
      this.timerState.status = 'critical';
      this.warningMessage = `¡Solo quedan ${remainingMinutes} minutos!`;
    } else if (remainingMinutes <= this.WARNING_THRESHOLD) {
      this.timerState.status = 'warning';
      this.warningMessage = `Tu reserva termina en ${remainingMinutes} minutos`;
    } else {
      this.timerState.status = 'active';
      this.warningMessage = '';
    }
  }

  private checkForNotifications(): void {
    const remainingMinutes = this.timerState.remainingMinutes;

    // Enviar notificaciones en los umbrales definidos (solo una vez por minuto)
    if (this.lastNotificationMinute !== remainingMinutes) {
      if (remainingMinutes === this.WARNING_THRESHOLD ||
        remainingMinutes === this.CRITICAL_THRESHOLD ||
        remainingMinutes === 1) {

        this.sendEndingNotification(remainingMinutes);
        this.lastNotificationMinute = remainingMinutes;
      }
    }
  }

  private sendEndingNotification(remainingMinutes: number): void {
    this.sendNotificationsUseCase.execute({
      bookingId: this.bookingId,
      notificationType: 'booking_ending',
      userId: this.currentUserId
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        console.log(`Notification sent for ${remainingMinutes} minutes remaining`);
      },
      error: (error) => {
        console.error('Error sending notification:', error);
      }
    });
  }

  private handleTimerExpired(): void {
    this.timerState.status = 'expired';

    // Enviar notificación de expiración
    this.sendNotificationsUseCase.execute({
      bookingId: this.bookingId,
      notificationType: 'booking_expired',
      userId: this.currentUserId
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe();

    // Redirigir después de 3 segundos
    setTimeout(() => {
      this.router.navigate(['/booking/booking-list']);
    }, 3000);
  }

  // Métodos de extensión
  openExtensionModal(): void {
    if (!this.timerState.canExtend) {
      this.errorMessage = 'No se pueden hacer extensiones para esta reserva';
      return;
    }

    this.showExtensionModal = true;
    this.errorMessage = '';
    this.extensionMessage = '';
  }

  closeExtensionModal(): void {
    this.showExtensionModal = false;
    this.selectedExtension = null;
  }

  selectExtension(option: ExtensionOption): void {
    this.selectedExtension = option;
  }

  confirmExtension(): void {
    if (!this.selectedExtension || this.isExtending) return;

    this.isExtending = true;
    this.errorMessage = '';

    this.extendReservationUseCase.execute({
      bookingId: this.bookingId,
      userId: this.currentUserId,
      additionalMinutes: this.selectedExtension.minutes
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        if (result.success) {
          // Actualizar el timer con el tiempo extendido
          this.timerState.remainingMinutes += this.selectedExtension!.minutes;
          this.timerState.totalMinutes += this.selectedExtension!.minutes;

          this.extensionMessage = `Reserva extendida por ${this.selectedExtension!.minutes} minutos`;
          this.updateTimerStatus();

          // Cerrar modal después de 2 segundos
          setTimeout(() => {
            this.closeExtensionModal();
            this.extensionMessage = '';
          }, 2000);
        } else {
          this.errorMessage = result.message;
        }
        this.isExtending = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al extender la reserva: ' + error.message;
        this.isExtending = false;
      }
    });
  }

  // Métodos de utilidad
  getProgressPercentage(): number {
    if (this.timerState.totalMinutes === 0) return 0;
    const usedMinutes = this.timerState.totalMinutes - this.timerState.remainingMinutes;
    return Math.min(100, (usedMinutes / this.timerState.totalMinutes) * 100);
  }

  getFormattedTime(): string {
    const minutes = this.timerState.remainingMinutes.toString().padStart(2, '0');
    const seconds = this.timerState.remainingSeconds.toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  getTimerColor(): string {
    switch (this.timerState.status) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'expired':
        return '#6b7280';
      default:
        return '#10b981';
    }
  }

  // Acciones adicionales
  endReservationEarly(): void {
    if (confirm('¿Estás seguro de que quieres terminar tu reserva ahora?')) {
      this.router.navigate(['/booking/booking-list']);
    }
  }

  viewBookingDetails(): void {
    this.router.navigate(['/booking/booking-list'], {
      queryParams: { selectedBooking: this.bookingId }
    });
  }
}
