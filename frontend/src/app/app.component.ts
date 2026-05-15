import { Component } from '@angular/core';
import { AirtableDashboardComponent } from './airtable/airtable-dashboard/airtable-dashboard.component';

@Component({
  selector: 'app-root',
  imports: [AirtableDashboardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
