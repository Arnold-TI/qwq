import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripLayout } from './trip-layout';

describe('TripLayout', () => {
  let component: TripLayout;
  let fixture: ComponentFixture<TripLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TripLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
