import { Routes } from '@angular/router';
import { AirtableDashboardComponent } from './airtable/airtable-dashboard/airtable-dashboard.component';

export const routes: Routes = [
    {
        path: 'airtable/success',
        component: AirtableDashboardComponent
    }
];
