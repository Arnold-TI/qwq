import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { CreateReservationUseCase } from '../../../application/use-cases/create-reservation.usecase';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './booking.html',
  styleUrl: './booking.css'
})
export class BookingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  bookingForm: FormGroup;
  vehicles: any[] = [];
  locations: any[] = [];
  isLoading = false;
  isSubmitting = false;

  // Nuevos campos para US-17
  selectedVehicle: any = null;
  selectedLocation: any = null;
  estimatedCost = 0;
  availableTimeSlots: any[] = [];

  // Estados del formulario
  showVehicleDetails = false;
  showLocationDetails = false;
  showConfirmation = false;

  // Configuración de notificaciones
  notificationPreferences = {
    startNotification: true,
    endingNotification: true,
    methods: ['push'],
    advanceMinutes: 5
  };

  constructor(
    private fb: FormBuilder,
    private createReservationUseCase: CreateReservationUseCase,
    private router: Router
  ) {
    this.bookingForm = this.initializeForm();
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): FormGroup {
    const now = new Date();
    const defaultStartTime = new Date(now.getTime() + (15 * 60000)); // 15 minutos desde ahora
    const defaultEndTime = new Date(defaultStartTime.getTime() + (60 * 60000)); // 1 hora después

    return this.fb.group({
      vehicleId: ['', Validators.required],
      locationId: ['', Validators.required],
      scheduledStartTime: [defaultStartTime.toISOString().slice(0, 16), Validators.required],
      scheduledEndTime: [defaultEndTime.toISOString().slice(0, 16), Validators.required],
      durationMinutes: [60, [Validators.required, Validators.min(15), Validators.max(480)]],

      // Nuevos campos US-17
      notificationPreferences: this.fb.group({
        startNotification: [true],
        endingNotification: [true],
        methods: [['push']],
        advanceMinutes: [5, [Validators.min(1), Validators.max(15)]]
      }),

      termsAccepted: [false, Validators.requiredTrue]
    });
  }

  private setupFormSubscriptions(): void {
    // Actualizar duración cuando cambien las fechas
    this.bookingForm.get('scheduledStartTime')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300)
    ).subscribe(() => {
      this.updateDurationAndCost();
      this.checkVehicleAvailability();
    });

    this.bookingForm.get('scheduledEndTime')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300)
    ).subscribe(() => {
      this.updateDurationAndCost();
    });

    // Actualizar costo cuando cambie la duración
    this.bookingForm.get('durationMinutes')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged()
    ).subscribe(() => {
      this.calculateEstimatedCost();
      this.updateEndTime();
    });

    // Cargar detalles del vehículo cuando se seleccione
    this.bookingForm.get('vehicleId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(vehicleId => {
      if (vehicleId) {
        this.loadVehicleDetails(vehicleId);
      }
    });

    // Cargar detalles de ubicación cuando se seleccione
    this.bookingForm.get('locationId')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(locationId => {
      if (locationId) {
        this.loadLocationDetails(locationId);
      }
    });
  }

  // US-17: Crear reserva
  onSubmit(): void {
    if (this.bookingForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formValue = this.bookingForm.value;

    const request = {
      userId: this.getCurrentUserId(),
      vehicleId: formValue.vehicleId,
      locationId: formValue.locationId,
      scheduledStartTime: new Date(formValue.scheduledStartTime),
      durationMinutes: formValue.durationMinutes,
      notificationPreferences: formValue.notificationPreferences
    };

    this.createReservationUseCase.execute(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.isSubmitting = false;

        if (result.success) {
          // Mostrar confirmación exitosa
          this.showConfirmation = true;

          // Redirigir a la lista de reservas después de 3 segundos
          setTimeout(() => {
            this.router.navigate(['/booking/booking-list'], {
              queryParams: { newBooking: result.booking?.id }
            });
          }, 3000);
        } else {
          this.handleBookingError(result.message);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.handleBookingError(error.message);
      }
    });
  }

  // Cargar datos iniciales
  private loadInitialData(): void {
    this.isLoading = true;

    // Simular carga de datos (en producción usar servicios)
    setTimeout(() => {
      this.vehicles = this.getMockVehicles();
      this.locations = this.getMockLocations();
      this.isLoading = false;
    }, 1000);
  }

  // Actualizar duración basada en fechas
  private updateDurationAndCost(): void {
    const startTime = this.bookingForm.get('scheduledStartTime')?.value;
    const endTime = this.bookingForm.get('scheduledEndTime')?.value;

    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diffMs = end.getTime() - start.getTime();
      const diffMinutes = Math.max(15, Math.floor(diffMs / 60000));

      this.bookingForm.patchValue({
        durationMinutes: diffMinutes
      }, { emitEvent: false });

      this.calculateEstimatedCost();
    }
  }

  // Actualizar hora de fin basada en duración
  private updateEndTime(): void {
    const startTime = this.bookingForm.get('scheduledStartTime')?.value;
    const duration = this.bookingForm.get('durationMinutes')?.value;

    if (startTime && duration) {
      const start = new Date(startTime);
      const end = new Date(start.getTime() + (duration * 60000));

      this.bookingForm.patchValue({
        scheduledEndTime: end.toISOString().slice(0, 16)
      }, { emitEvent: false });
    }
  }

  // Calcular costo estimado
  private calculateEstimatedCost(): void {
    const duration = this.bookingForm.get('durationMinutes')?.value;
    if (duration) {
      const baseRate = 0.50; // $0.50 por minuto
      this.estimatedCost = duration * baseRate;
    }
  }

  // Verificar disponibilidad del vehículo
  private checkVehicleAvailability(): void {
    const vehicleId = this.bookingForm.get('vehicleId')?.value;
    const startTime = this.bookingForm.get('scheduledStartTime')?.value;

    if (vehicleId && startTime) {
      // Aquí implementarías la verificación real de disponibilidad
      console.log(`Checking availability for vehicle ${vehicleId} at ${startTime}`);
    }
  }

  // Cargar detalles del vehículo seleccionado
  private loadVehicleDetails(vehicleId: string): void {
    this.selectedVehicle = this.vehicles.find(v => v.id === vehicleId);
    this.showVehicleDetails = !!this.selectedVehicle;
  }

  // Cargar detalles de la ubicación seleccionada
  private loadLocationDetails(locationId: string): void {
    this.selectedLocation = this.locations.find(l => l.id === locationId);
    this.showLocationDetails = !!this.selectedLocation;
  }

  // Manejar errores de reserva
  private handleBookingError(message: string): void {
    // Implementar manejo de errores (toast, modal, etc.)
    console.error('Booking error:', message);
    alert('Error al crear la reserva: ' + message);
  }

  // Obtener usuario actual
  private getCurrentUserId(): string {
    return localStorage.getItem('currentUserId') || '1';
  }

  // Datos mock
  private getMockVehicles(): any[] {
    return [
      {
        id: '1',
        brand: 'Xiaomi',
        model: 'M365',
        type: 'scooter',
        battery: 85,
        rate: 0.50,
        image: '/assets/vehicles/xiaomi-m365.jpg',
        features: ['GPS', 'Bluetooth', 'Anti-robo'],
        status: 'available'
      },
      {
        id: '2',
        brand: 'Segway',
        model: 'Ninebot ES2',
        type: 'scooter',
        battery: 72,
        rate: 0.45,
        image: '/assets/vehicles/segway-es2.jpg',
        features: ['GPS', 'Luces LED', 'Plegable'],
        status: 'available'
      }
    ];
  }

  private getMockLocations(): any[] {
    return [
      {
        id: '1',
        name: 'Plaza San Martín',
        address: 'Jr. de la Unión, Lima Centro',
        coordinates: { lat: -12.046374, lng: -77.042793 },
        vehicleCount: 8
      },
      {
        id: '2',
        name: 'Parque Kennedy',
        address: 'Av. Larco, Miraflores',
        coordinates: { lat: -12.121932, lng: -77.031797 },
        vehicleCount: 12
      }
    ];
  }

  // Métodos de utilidad para el template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.bookingForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.bookingForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
      if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;
    }
    return '';
  }

  // Formatear tiempo para display
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins > 0 ? mins + 'm' : ''}`.trim();
    }
    return `${mins}m`;
  }

  // Formatear costo
  formatCost(cost: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'USD'
    }).format(cost);
  }
}
