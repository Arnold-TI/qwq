import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanPayment } from './plan-payment';

describe('PlanPayment', () => {
  let component: PlanPayment;
  let fixture: ComponentFixture<PlanPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
