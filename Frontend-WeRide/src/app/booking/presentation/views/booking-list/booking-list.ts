import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, interval, switchMap } from 'rxjs';
import { BookingRepository } from '../../../domain/repositories/booking.repository';
import { BookingTimerService } from '../../../domain/services/booking-timer.service';
import { ExtendReservationUseCase } from '../../../application/use-cases/extend-reservation.usecase';

interface BookingWithTimer {
  id: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  status: string;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  location: string;
  estimatedCost: number;

  // Timer específico - US-16, US-18
  timer?: {
    remainingMinutes: number;
    remainingSeconds: number;
    status: 'active' | 'warning' | 'critical' | 'expired';
    canExtend: boolean;
    totalMinutes: number;
  };
}

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-list.html',
  styleUrls: ['./booking-list.css']
})
export class BookingListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly TIMER_UPDATE_INTERVAL = 1000; // 1 segundo

  bookings: BookingWithTimer[] = [];
  activeBooking: BookingWithTimer | null = null;

  isLoading = false;
  showExtensionModal = false;
  selectedBookingForExtension: BookingWithTimer | null = null;

  extensionOptions = [
    { minutes: 15, cost: 7.50, label: '15 min' },
    { minutes: 30, cost: 15.00, label: '30 min' },
    { minutes: 60, cost: 28.00, label: '1 hora' }
  ];

  constructor(
    private bookingRepository: BookingRepository,
    private timerService: BookingTimerService,
    private extendReservationUseCase: ExtendReservationUseCase,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBookings();
    this.startTimerUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Cargar reservas del usuario
  private loadBookings(): void {
    this.isLoading = true;
    const userId = this.getCurrentUserId();

    this.bookingRepository.getUserBookings(userId, 10).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (bookings) => {
        this.bookings = bookings.map(booking => this.enrichBookingWithTimer(booking));
        this.activeBooking = this.bookings.find(b => b.status === 'active') || null;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading bookings:', error);
        this.isLoading = false;
      }
    });
  }

  // US-16, US-18: Iniciar actualizaciones del timer
  private startTimerUpdates(): void {
    interval(this.TIMER_UPDATE_INTERVAL).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.updateActiveBookingTimers())
    ).subscribe();
  }

  // Actualizar timers de reservas activas
  private updateActiveBookingTimers(): Promise<void> {
    return new Promise((resolve) => {
      this.bookings.forEach(booking => {
        if (booking.status === 'active' && booking.timer) {
          this.updateBookingTimer(booking);
        }
      });
      resolve();
    });
  }

  // Actualizar timer individual de reserva
  private updateBookingTimer(booking: BookingWithTimer): void {
    if (!booking.timer) return;

    const now = new Date();
    const endTime = new Date(booking.scheduledEndTime);
    const remainingMs = Math.max(0, endTime.getTime() - now.getTime());

    const remainingMinutes = Math.floor(remainingMs / 60000);
    const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

    // Actualizar timer
    booking.timer.remainingMinutes = remainingMinutes;
    booking.timer.remainingSeconds = remainingSeconds;

    // Actualizar estado del timer
    if (remainingMinutes <= 0) {
      booking.timer.status = 'expired';
      booking.status = 'expired';
    } else if (remainingMinutes <= 5) {
      booking.timer.status = 'critical';
    } else if (remainingMinutes <= 10) {
      booking.timer.status = 'warning';
    } else {
      booking.timer.status = 'active';
    }
  }

  // Enriquecer reserva con información de timer
  private enrichBookingWithTimer(booking: any): BookingWithTimer {
    const enriched = {
      ...booking,
      vehicleBrand: 'Xiaomi', // Mock data - en producción vendría de join
      vehicleModel: 'M365',
      location: 'Plaza San Martín'
    };

    // Solo agregar timer si la reserva está activa
    if (booking.status === 'active') {
      const now = new Date();
      const startTime = new Date(booking.scheduledStartTime);
      const endTime = new Date(booking.scheduledEndTime);
      const totalMs = endTime.getTime() - startTime.getTime();
      const remainingMs = Math.max(0, endTime.getTime() - now.getTime());

      enriched.timer = {
        remainingMinutes: Math.floor(remainingMs / 60000),
        remainingSeconds: Math.floor((remainingMs % 60000) / 1000),
        status: this.calculateTimerStatus(remainingMs),
        canExtend: booking.allowExtensions,
        totalMinutes: Math.ceil(totalMs / 60000)
      };
    }

    return enriched;
  }

  // Calcular estado del timer
  private calculateTimerStatus(remainingMs: number): 'active' | 'warning' | 'critical' | 'expired' {
    const remainingMinutes = Math.floor(remainingMs / 60000);

    if (remainingMinutes <= 0) return 'expired';
    if (remainingMinutes <= 5) return 'critical';
    if (remainingMinutes <= 10) return 'warning';
    return 'active';
  }

  // US-16: Abrir modal de extensión
  openExtensionModal(booking: BookingWithTimer): void {
    if (!booking.timer?.canExtend) return;

    this.selectedBookingForExtension = booking;
    this.showExtensionModal = true;
  }

  // US-16: Extender reserva
  extendBooking(minutes: number, cost: number): void {
    if (!this.selectedBookingForExtension) return;

    this.extendReservationUseCase.execute({
      bookingId: this.selectedBookingForExtension.id,
      userId: this.getCurrentUserId(),
      additionalMinutes: minutes
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        if (result.success && this.selectedBookingForExtension) {
          // Actualizar la reserva localmente
          this.selectedBookingForExtension.scheduledEndTime = result.newEndTime!;
          this.updateBookingTimer(this.selectedBookingForExtension);

          this.showExtensionModal = false;
          this.selectedBookingForExtension = null;
        }
      },
      error: (error) => {
        console.error('Error extending booking:', error);
      }
    });
  }

  // Navegar a detalles de reserva
  viewBookingDetails(booking: BookingWithTimer): void {
    this.router.navigate(['/booking/details'], {
      queryParams: { bookingId: booking.id }
    });
  }

  // Navegar a desbloqueo
  unlockVehicle(booking: BookingWithTimer): void {
    this.router.navigate(['/booking/unlock-vehicle'], {
      queryParams: { bookingId: booking.id }
    });
  }

  // Escanear QR
  scanQR(): void {
    this.router.navigate(['/booking/qr-scanner']);
  }

  // Crear nueva reserva
  createNewBooking(): void {
    this.router.navigate(['/booking/booking-form']);
  }

  // Formatear tiempo para mostrar
  formatTime(minutes: number, seconds: number): string {
    const m = Math.max(0, minutes).toString().padStart(2, '0');
    const s = Math.max(0, seconds).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Obtener color del timer según estado
  getTimerColor(status: string): string {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'expired': return '#6b7280';
      default: return '#10b981';
    }
  }

  // Obtener progreso del timer
  getTimerProgress(booking: BookingWithTimer): number {
    if (!booking.timer) return 0;

    const used = booking.timer.totalMinutes - booking.timer.remainingMinutes;
    return Math.min(100, (used / booking.timer.totalMinutes) * 100);
  }

  // Obtener usuario actual
  private getCurrentUserId(): string {
    return localStorage.getItem('currentUserId') || '1';
  }
}
