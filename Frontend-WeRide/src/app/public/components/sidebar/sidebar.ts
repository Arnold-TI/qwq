import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MatIconButton } from '@angular/material/button';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, MatIconModule, RouterModule, MatIconButton],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  @Input() collapsed = false;
}
