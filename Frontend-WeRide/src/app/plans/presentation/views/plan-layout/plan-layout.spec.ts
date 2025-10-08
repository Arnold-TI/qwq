import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanLayout } from './plan-layout';

describe('PlanLayout', () => {
  let component: PlanLayout;
  let fixture: ComponentFixture<PlanLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
