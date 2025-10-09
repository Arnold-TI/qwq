import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { UnlockWithQRUseCase } from '../../../application/use-cases/unlock-with-qr.usecase';

declare var QrScanner: any;

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.css']
})
export class QrScannerComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;

  private destroy$ = new Subject<void>();
  private qrScanner: any;

  // Estados del componente
  isScanning = false;
  isProcessing = false;
  hasCamera = false;
  cameraError = '';

  // Resultados
  scanResult = '';
  unlockResult: any = null;
  errorMessage = '';
  successMessage = '';

  // UI States
  showResult = false;
  showError = false;
  showSuccess = false;

  constructor(
    private unlockWithQRUseCase: UnlockWithQRUseCase,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkCameraSupport();
  }

  ngOnDestroy(): void {
    this.stopScanning();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Verificar soporte de cámara
  async checkCameraSupport(): Promise<void> {
    try {
      const hasCamera = await QrScanner.hasCamera();
      this.hasCamera = hasCamera;

      if (!hasCamera) {
        this.showError = true;
        this.errorMessage = 'No se detectó cámara en el dispositivo';
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error checking camera:', error);
      this.hasCamera = false;
      this.showError = true;
      this.errorMessage = 'Error al acceder a la cámara';
      this.cdr.detectChanges();
    }
  }

  // Iniciar escaneo
  async startScanning(): Promise<void> {
    if (!this.hasCamera) {
      this.showError = true;
      this.errorMessage = 'Cámara no disponible';
      return;
    }

    try {
      this.isScanning = true;
      this.clearMessages();

      // Inicializar el scanner después de que la vista se actualice
      setTimeout(async () => {
        await this.initializeScanner();
      }, 100);

    } catch (error) {
      console.error('Error starting scanner:', error);
      this.showError = true;
      this.errorMessage = 'Error al iniciar el escáner';
      this.isScanning = false;
    }
  }

  // Inicializar el scanner QR
  private async initializeScanner(): Promise<void> {
    try {
      if (this.videoElement?.nativeElement) {
        this.qrScanner = new QrScanner(
          this.videoElement.nativeElement,
          (result: any) => this.onScanSuccess(result.data),
          {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
          }
        );

        await this.qrScanner.start();
        console.log('QR Scanner started successfully');
      }
    } catch (error) {
      console.error('Error initializing scanner:', error);
      this.showError = true;
      this.errorMessage = 'Error al inicializar el escáner QR';
      this.isScanning = false;
      this.cdr.detectChanges();
    }
  }

  // Parar escaneo
  stopScanning(): void {
    if (this.qrScanner) {
      this.qrScanner.stop();
      this.qrScanner.destroy();
      this.qrScanner = null;
    }
    this.isScanning = false;
  }

  // Manejar resultado exitoso del escaneo
  private onScanSuccess(qrData: string): void {
    console.log('QR Code detected:', qrData);

    this.scanResult = qrData;
    this.isProcessing = true;
    this.stopScanning();

    // Procesar el QR escaneado
    this.processQRCode(qrData);
  }

  // Procesar código QR escaneado (US-19)
  private processQRCode(qrData: string): void {
    const userId = this.getCurrentUserId(); // Obtener del contexto/storage
    const userLocation = this.getCurrentLocation(); // Obtener ubicación actual

    this.unlockWithQRUseCase.execute({
      qrData,
      userId,
      userLocation
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.isProcessing = false;
        this.unlockResult = result;

        if (result.success) {
          this.showSuccess = true;
          this.successMessage = result.message;

          // Redirigir a estado de desbloqueo después de 2 segundos
          setTimeout(() => {
            this.router.navigate(['/booking/unlock-status'], {
              queryParams: { unlockRequestId: result.unlockRequestId }
            });
          }, 2000);
        } else {
          this.showError = true;
          this.errorMessage = result.message;
        }

        this.showResult = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isProcessing = false;
        this.showError = true;
        this.errorMessage = 'Error al procesar QR: ' + error.message;
        this.showResult = true;
        this.cdr.detectChanges();
      }
    });
  }

  // Reintentar escaneo
  retryScanning(): void {
    this.clearMessages();
    this.showResult = false;
    this.startScanning();
  }

  // Limpiar mensajes
  private clearMessages(): void {
    this.showError = false;
    this.showSuccess = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.scanResult = '';
    this.unlockResult = null;
  }

  // Navegar atrás
  goBack(): void {
    this.router.navigate(['/booking']);
  }

  // Ir a desbloqueo manual
  goToManualUnlock(): void {
    this.router.navigate(['/booking/unlock-vehicle']);
  }

  // Métodos auxiliares (en producción estos vendrían de servicios)
  private getCurrentUserId(): string {
    return localStorage.getItem('currentUserId') || '1';
  }

  private getCurrentLocation(): { lat: number; lng: number } {
    // En producción usarías el Geolocation API
    return {
      lat: -12.046374,
      lng: -77.042793
    };
  }

  // Formatear mensaje de error
  getErrorIcon(): string {
    if (this.errorMessage.includes('cámara')) return '📷';
    if (this.errorMessage.includes('QR')) return '📱';
    if (this.errorMessage.includes('conexión')) return '🌐';
    if (this.errorMessage.includes('autorización')) return '🔒';
    return '⚠️';
  }

  // Obtener clase CSS para el estado
  getStatusClass(): string {
    if (this.isProcessing) return 'processing';
    if (this.showSuccess) return 'success';
    if (this.showError) return 'error';
    if (this.isScanning) return 'scanning';
    return 'idle';
  }
}
