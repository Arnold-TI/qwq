import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, timer, switchMap } from 'rxjs';
import { UnlockFromAppUseCase } from '../../../application/use-cases/unlock-from-app.usecase';
import { GetUnlockStatusUseCase } from '../../../application/use-cases/get-unlock-status.usecase';
import { BookingRepository } from '../../../domain/repositories/booking.repository';

interface UnlockState {
  status: 'idle' | 'checking' | 'unlocking' | 'success' | 'failed';
  message: string;
  unlockRequestId?: string;
  canRetry: boolean;
  retryCount: number;
  estimatedRetryTime?: Date;
}

@Component({
  selector: 'app-unlock-vehicle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unlock-vehicle.html',
  styleUrls: ['./unlock-vehicle.css']
})
export class UnlockVehicleComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private statusCheckInterval: any;

  // Estados del componente
  unlockState: UnlockState = {
    status: 'idle',
    message: '',
    canRetry: false,
    retryCount: 0
  };

  // Información de la reserva
  bookingInfo: any = null;
  vehicleInfo: any = null;
  userLocation: any = null;

  // Parámetros de la URL
  bookingId: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unlockFromAppUseCase: UnlockFromAppUseCase,
    private getUnlockStatusUseCase: GetUnlockStatusUseCase,
    private bookingRepository: BookingRepository
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.clearStatusInterval();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Inicializar componente
  private initializeComponent(): void {
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      this.bookingId = params['bookingId'];

      if (this.bookingId) {
        this.loadBookingInfo();
      } else {
        this.findActiveBooking();
      }
    });

    this.getCurrentLocation();
  }

  // Cargar información de la reserva
  private loadBookingInfo(): void {
    this.unlockState.status = 'checking';
    this.unlockState.message = 'Verificando reserva...';

    this.bookingRepository.getBookingById(this.bookingId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (booking) => {
        if (booking) {
          this.bookingInfo = booking;
          this.loadVehicleInfo(booking.vehicleId);
        } else {
          this.unlockState = {
            status: 'failed',
            message: 'Reserva no encontrada',
            canRetry: false,
            retryCount: 0
          };
        }
      },
      error: (error) => {
        this.unlockState = {
          status: 'failed',
          message: 'Error al cargar información de la reserva',
          canRetry: true,
          retryCount: 0
        };
      }
    });
  }

  // Buscar reserva activa si no se proporciona ID
  private findActiveBooking(): void {
    const userId = this.getCurrentUserId();

    this.bookingRepository.getActiveBookingByUserId(userId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (booking) => {
        if (booking) {
          this.bookingId = booking.id;
          this.bookingInfo = booking;
          this.loadVehicleInfo(booking.vehicleId);
        } else {
          this.unlockState = {
            status: 'failed',
            message: 'No tienes reservas activas',
            canRetry: false,
            retryCount: 0
          };
        }
      },
      error: (error) => {
        this.unlockState = {
          status: 'failed',
          message: 'Error al buscar reserva activa',
          canRetry: true,
          retryCount: 0
        };
      }
    });
  }

  // Cargar información del vehículo
  private loadVehicleInfo(vehicleId: string): void {
    // Simular carga de información del vehículo
    this.vehicleInfo = {
      id: vehicleId,
      brand: 'Xiaomi',
      model: 'M365',
      battery: 85,
      location: 'Plaza San Martín',
      image: '/assets/vehicles/xiaomi-m365.jpg'
    };

    this.unlockState = {
      status: 'idle',
      message: 'Listo para desbloquear',
      canRetry: false,
      retryCount: 0
    };
  }

  // US-20: Desbloquear desde la app
  unlockVehicle(): void {
    if (!this.bookingId || this.unlockState.status === 'unlocking') {
      return;
    }

    this.unlockState = {
      status: 'unlocking',
      message: 'Desbloqueando vehículo...',
      canRetry: false,
      retryCount: this.unlockState.retryCount
    };

    this.unlockFromAppUseCase.execute({
      bookingId: this.bookingId,
      userId: this.getCurrentUserId(),
      userLocation: this.userLocation
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        if (result.success) {
          this.unlockState = {
            status: 'success',
            message: result.message,
            unlockRequestId: result.unlockRequestId,
            canRetry: false,
            retryCount: 0
          };

          // Iniciar monitoreo del estado
          this.startStatusMonitoring(result.unlockRequestId!);

          // Redirigir a estado después de 3 segundos
          setTimeout(() => {
            this.router.navigate(['/booking/unlock-status'], {
              queryParams: { unlockRequestId: result.unlockRequestId }
            });
          }, 3000);
        } else {
          this.handleUnlockError(result.message, result.errorCode);
        }
      },
      error: (error) => {
        this.handleUnlockError('Error inesperado al desbloquear', 'UNKNOWN_ERROR');
      }
    });
  }

  // Manejar errores de desbloqueo
  private handleUnlockError(message: string, errorCode?: string): void {
    const canRetry = this.shouldAllowRetry(errorCode);
    const estimatedRetryTime = canRetry ? new Date(Date.now() + 30000) : undefined;

    this.unlockState = {
      status: 'failed',
      message,
      canRetry,
      retryCount: this.unlockState.retryCount + 1,
      estimatedRetryTime
    };
  }

  // Determinar si se puede reintentar
  private shouldAllowRetry(errorCode?: string): boolean {
    const maxRetries = 3;
    const nonRetryableCodes = ['UNAUTHORIZED', 'BOOKING_NOT_FOUND', 'INVALID_BOOKING_STATUS'];

    return this.unlockState.retryCount < maxRetries &&
      !nonRetryableCodes.includes(errorCode || '');
  }

  // Iniciar monitoreo del estado del desbloqueo
  private startStatusMonitoring(unlockRequestId: string): void {
    this.statusCheckInterval = setInterval(() => {
      this.checkUnlockStatus(unlockRequestId);
    }, 2000); // Verificar cada 2 segundos
  }

  // Verificar estado del desbloqueo
  private checkUnlockStatus(unlockRequestId: string): void {
    this.getUnlockStatusUseCase.execute({
      unlockRequestId,
      userId: this.getCurrentUserId()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (status) => {
        if (status.status === 'success' || status.status === 'failed') {
          this.clearStatusInterval();

          if (status.status === 'success') {
            this.unlockState.message = '✅ Vehículo desbloqueado exitosamente';
          } else {
            this.unlockState = {
              status: 'failed',
              message: status.message,
              canRetry: status.canRetry,
              retryCount: status.retryCount
            };
          }
        }
      },
      error: (error) => {
        console.error('Error checking unlock status:', error);
      }
    });
  }

  // Limpiar interval de verificación
  private clearStatusInterval(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  // Reintentar desbloqueo
  retryUnlock(): void {
    if (this.unlockState.canRetry && this.unlockState.status === 'failed') {
      this.unlockVehicle();
    }
  }

  // Obtener ubicación actual del usuario
  private getCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
        },
        (error) => {
          console.warn('Could not get user location:', error);
          // Usar ubicación por defecto
          this.userLocation = {
            lat: -12.046374,
            lng: -77.042793,
            accuracy: 100
          };
        }
      );
    } else {
      // Usar ubicación por defecto si no hay soporte de geolocation
      this.userLocation = {
        lat: -12.046374,
        lng: -77.042793,
        accuracy: 100
      };
    }
  }

  // Navegar a escáner QR
  goToQRScanner(): void {
    this.router.navigate(['/booking/qr-scanner']);
  }

  // Navegar a estado de desbloqueo
  goToUnlockStatus(): void {
    if (this.unlockState.unlockRequestId) {
      this.router.navigate(['/booking/unlock-status'], {
        queryParams: { unlockRequestId: this.unlockState.unlockRequestId }
      });
    }
  }

  // Navegar atrás
  goBack(): void {
    this.router.navigate(['/booking/booking-list']);
  }

  // Obtener usuario actual
  private getCurrentUserId(): string {
    return localStorage.getItem('currentUserId') || '1';
  }

  // Obtener icono según estado
  getStatusIcon(): string {
    switch (this.unlockState.status) {
      case 'checking':
      case 'unlocking':
        return 'fa-spinner fa-spin';
      case 'success':
        return 'fa-check-circle';
      case 'failed':
        return 'fa-exclamation-circle';
      default:
        return 'fa-unlock';
    }
  }

  // Obtener color según estado
  getStatusColor(): string {
    switch (this.unlockState.status) {
      case 'success':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'unlocking':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  // Formatear tiempo restante para retry
  getRetryCountdown(): string {
    if (!this.unlockState.estimatedRetryTime) return '';

    const now = new Date();
    const retryTime = new Date(this.unlockState.estimatedRetryTime);
    const remainingSeconds = Math.max(0, Math.floor((retryTime.getTime() - now.getTime()) / 1000));

    return remainingSeconds > 0 ? `Reintentar en ${remainingSeconds}s` : 'Listo para reintentar';
  }
}
