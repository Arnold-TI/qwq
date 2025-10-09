import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, timer, switchMap } from 'rxjs';
import { GetUnlockStatusUseCase } from '../../../application/use-cases/get-unlock-status.usecase';

interface VehicleStatus {
  isLocked: boolean;
  batteryLevel: number;
  connectionStatus: 'online' | 'offline' | 'weak';
  lastActivity?: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

interface UnlockStatusDetail {
  unlockRequestId: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'expired';
  message: string;
  progress: number;
  estimatedTimeRemaining?: number;
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
  vehicleStatus?: VehicleStatus;
  lastUpdated: Date;
  attemptHistory: any[];
}

@Component({
  selector: 'app-vehicle-unlock-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-unlock-status.html',
  styleUrls: ['./vehicle-unlock-status.css']
})
export class VehicleUnlockStatusComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private statusCheckInterval: any;
  private readonly STATUS_CHECK_INTERVAL = 2000; // 2 segundos

  unlockRequestId: string = '';
  statusDetail: UnlockStatusDetail | null = null;
  isLoading = true;
  error = '';

  // Estados de UI
  showRetryButton = false;
  showDetails = false;
  autoRefresh = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private getUnlockStatusUseCase: GetUnlockStatusUseCase
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.stopStatusChecking();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Inicializar componente
  private initializeComponent(): void {
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      this.unlockRequestId = params['unlockRequestId'];

      if (this.unlockRequestId) {
        this.loadUnlockStatus();
        this.startStatusChecking();
      } else {
        this.error = 'ID de solicitud de desbloqueo no proporcionado';
        this.isLoading = false;
      }
    });
  }

  // US-21: Cargar estado de desbloqueo
  private loadUnlockStatus(): void {
    this.getUnlockStatusUseCase.execute({
      unlockRequestId: this.unlockRequestId,
      userId: this.getCurrentUserId()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (status) => {
        this.statusDetail = {
          ...status,
          attemptHistory: this.generateAttemptHistory(status)
        };

        this.updateUIState();
        this.isLoading = false;

        // Detener auto-refresh si el proceso terminó
        if (this.isStatusFinal(status.status)) {
          this.stopStatusChecking();
          this.autoRefresh = false;
        }
      },
      error: (error) => {
        this.error = 'Error al obtener el estado: ' + error.message;
        this.isLoading = false;
        this.stopStatusChecking();
      }
    });
  }

  // Actualizar estado de la UI
  private updateUIState(): void {
    if (!this.statusDetail) return;

    this.showRetryButton = this.statusDetail.canRetry &&
      this.statusDetail.status === 'failed';
  }

  // Iniciar verificación automática del estado
  private startStatusChecking(): void {
    if (!this.autoRefresh) return;

    this.statusCheckInterval = setInterval(() => {
      this.loadUnlockStatus();
    }, this.STATUS_CHECK_INTERVAL);
  }

  // Detener verificación automática
  private stopStatusChecking(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  // Verificar si el estado es final
  private isStatusFinal(status: string): boolean {
    return ['success', 'failed', 'expired'].includes(status);
  }

  // Generar historial de intentos
  private generateAttemptHistory(status: any): any[] {
    const history = [];

    for (let i = 1; i <= status.retryCount + 1; i++) {
      const isLast = i === status.retryCount + 1;
      const attemptStatus = isLast ? status.status :
        i < status.retryCount + 1 ? 'failed' : 'pending';

      history.push({
        attempt: i,
        timestamp: new Date(Date.now() - ((status.retryCount + 1 - i) * 30000)),
        status: attemptStatus,
        method: 'app_button'
      });
    }

    return history;
  }

  // Acciones del usuario
  retryUnlock(): void {
    if (!this.statusDetail?.canRetry) return;

    // Reiniciar estado y solicitar nuevo intento
    this.isLoading = true;
    this.autoRefresh = true;
    this.startStatusChecking();

    // Aquí integrarías con el servicio de retry
    console.log('Retrying unlock request:', this.unlockRequestId);
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;

    if (this.autoRefresh && !this.isStatusFinal(this.statusDetail?.status || '')) {
      this.startStatusChecking();
    } else {
      this.stopStatusChecking();
    }
  }

  // Navegar atrás
  goBack(): void {
    this.router.navigate(['/booking/unlock-vehicle']);
  }

  // Navegar a lista de reservas
  goToBookings(): void {
    this.router.navigate(['/booking/booking-list']);
  }

  // Obtener usuario actual
  private getCurrentUserId(): string {
    return localStorage.getItem('currentUserId') || '1';
  }

  // Métodos de utilidad para el template
  getStatusIcon(): string {
    if (!this.statusDetail) return 'fa-question-circle';

    switch (this.statusDetail.status) {
      case 'pending':
        return 'fa-clock';
      case 'processing':
        return 'fa-spinner fa-spin';
      case 'success':
        return 'fa-check-circle';
      case 'failed':
        return 'fa-exclamation-circle';
      case 'expired':
        return 'fa-times-circle';
      default:
        return 'fa-question-circle';
    }
  }

  getStatusColor(): string {
    if (!this.statusDetail) return '#6b7280';

    switch (this.statusDetail.status) {
      case 'success':
        return '#10b981';
      case 'failed':
      case 'expired':
        return '#ef4444';
      case 'processing':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  getProgressBarColor(): string {
    if (!this.statusDetail) return '#e5e7eb';

    switch (this.statusDetail.status) {
      case 'success':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'processing':
        return '#3b82f6';
      default:
        return '#9ca3af';
    }
  }

  formatEstimatedTime(): string {
    if (!this.statusDetail?.estimatedTimeRemaining) return '';

    const seconds = this.statusDetail.estimatedTimeRemaining;
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  getConnectionStatusIcon(): string {
    if (!this.statusDetail?.vehicleStatus) return 'fa-question-circle';

    switch (this.statusDetail.vehicleStatus.connectionStatus) {
      case 'online':
        return 'fa-wifi text-green-500';
      case 'weak':
        return 'fa-wifi text-yellow-500';
      case 'offline':
        return 'fa-wifi-slash text-red-500';
      default:
        return 'fa-question-circle text-gray-500';
    }
  }

  getBatteryIcon(): string {
    if (!this.statusDetail?.vehicleStatus) return 'fa-battery-empty';

    const batteryLevel = this.statusDetail.vehicleStatus.batteryLevel;
    if (batteryLevel > 75) return 'fa-battery-full';
    if (batteryLevel > 50) return 'fa-battery-three-quarters';
    if (batteryLevel > 25) return 'fa-battery-half';
    if (batteryLevel > 10) return 'fa-battery-quarter';
    return 'fa-battery-empty';
  }

  getBatteryColor(): string {
    if (!this.statusDetail?.vehicleStatus) return '#6b7280';

    const batteryLevel = this.statusDetail.vehicleStatus.batteryLevel;
    if (batteryLevel > 50) return '#10b981';
    if (batteryLevel > 20) return '#f59e0b';
    return '#ef4444';
  }
}
