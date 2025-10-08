import { Component } from '@angular/core';
import {PlanList} from '../plan-list/plan-list';
import {PlanDetail} from '../plan-detail/plan-detail';

@Component({
  selector: 'app-plan-layout',
  imports: [
    PlanList,
    PlanDetail
  ],
  templateUrl: './plan-layout.html',
  styleUrl: './plan-layout.css'
})
export class PlanLayout {

}
