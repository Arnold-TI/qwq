export class Location {
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public coordinates: { lat: number; lng: number }
  ) {}
}

