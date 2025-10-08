export class Vehicle {
  constructor(
    public id: string,
    public brand: string,
    public model: string,
    public year: number,
    public battery: number,
    public location: string,
    public status: 'available' | 'reserved' | 'maintenance'
  ) {}
}

