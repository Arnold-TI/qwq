import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripMap } from './trip-map';

describe('TripMap', () => {
  let component: TripMap;
  let fixture: ComponentFixture<TripMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TripMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
