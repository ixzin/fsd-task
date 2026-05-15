import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
} from 'ag-grid-community';
import {
  AirtableBase,
  AirtablePage,
  AirtableRevision,
  AirtableTable,
  AuthData,
} from '../models/airtable.models';
import { AirtableApiService } from '../services/airtable-api.service';
import { airtableGridTheme } from '../config/airtable-grid.config';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-airtable-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    AgGridAngular,
  ],
  templateUrl: './airtable-dashboard.component.html',
  styleUrl: './airtable-dashboard.component.scss',
})
export class AirtableDashboardComponent implements OnInit {
  bases: AirtableBase[] = [];
  tables: AirtableTable[] = [];
  pages: AirtablePage[] = [];
  revisions: AirtableRevision[] = [];

  selectedBaseId = '';
  selectedTableId = '';
  activeIntegration = 'airtable';
  searchText = '';
  loading = false;
  error = '';
  lastSyncMessage = '';
  rowData: Record<string, unknown>[] = [];
  colDefs: ColDef[] = [];
  gridTheme = airtableGridTheme;
  defaultColDef: ColDef = {
    filter: true,
    floatingFilter: true,
    resizable: true,
    sortable: true,
  };
  cookiesError = '';
  authData: Partial<AuthData> = {};

  constructor(private readonly airtableApi: AirtableApiService) {}

  ngOnInit() {
    this.loadBases();
  }

  loadBases() {
    this.loading = true;
    this.error = '';
    this.lastSyncMessage = '';

    this.airtableApi.getBases().subscribe({
      next: (bases) => {
        this.bases = bases;
        this.selectedBaseId = this.selectedBaseId || bases[0]?.id || '';
        this.loading = false;
        this.loadTables();
      },
      error: (error) => this.handleError(error),
    });
  }

  loadTables() {
    if (!this.selectedBaseId) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.lastSyncMessage = '';

    this.airtableApi.getTables(this.selectedBaseId).subscribe({
      next: (tables) => {
        this.tables = tables;
        this.selectedTableId = this.selectedTableId || tables[0]?.id || '';
        this.loading = false;
        this.loadPages();
      },
      error: (error) => this.handleError(error),
    });
  }

  onBaseChange() {
    this.selectedTableId = '';
    this.tables = [];
    this.setPages([]);
    this.loadTables();
  }

  onTableChange() {
    this.loadPages();
  }

  loadPages() {
    this.startLoading();

    this.airtableApi.getPages(this.currentFilters()).subscribe({
      next: (pages) => {
        this.setPages(pages);
        this.loading = false;
      },
      error: (error) => this.handleError(error),
    });
  }

  loadRevisions() {
    this.startLoading();

    this.airtableApi.getRevisions(this.currentFilters()).subscribe({
      next: (revisions) => {
        this.revisions = revisions;
        this.loading = false;
      },
      error: (error) => this.handleError(error),
    });
  }

  loginRevisionCookies() {
    this.startLoading();
    this.cookiesError = '';
    if (this.authData && this.authData.email && this.authData.password) {
      this.airtableApi.loginRevisionCookies(this.authData as AuthData).subscribe({
        next: (res) => {
          if (!res.cookiesCount) {
            this.cookiesError = 'No cookies found';
          }
        },
        error: (error) => {
          this.cookiesError = error.error?.message || 'Unexpected error';
          this.handleError(error);
        },
        complete: () => {
          this.loading = false;
        }
      });
    } else {
      this.cookiesError = 'Email and password fields are required';
      this.loading = false;
    }
  }

  syncPages() {
    this.startLoading();

    this.airtableApi.syncPages(this.currentFilters()).subscribe({
      next: (result) => {
        this.lastSyncMessage = `Pages synced: ${result.pagesCount}`;
        this.loading = false;
        this.loadPages();
      },
      error: (error) => this.handleError(error),
    });
  }

  syncRevisions() {
    this.startLoading();

    this.airtableApi.syncRevisions(this.currentFilters()).subscribe({
      next: (result) => {
        this.lastSyncMessage = `Revisions synced: ${result.revisionsCount}`;
        this.loading = false;
        this.loadRevisions();
      },
      error: (error) => this.handleError(error),
    });
  }

  auth() {
    this.airtableApi.getOAuthUrl().subscribe({
      next: ({ url }) => {
        window.location.href = url;
      },
      error: (error) => this.handleError(error),
    });
  }

  private startLoading() {
    this.loading = true;
    this.error = '';
    this.lastSyncMessage = '';
  }

  private currentFilters() {
    return {
      baseId: this.selectedBaseId || undefined,
      tableId: this.selectedTableId || undefined,
    };
  }

  private setPages(pages: AirtablePage[]) {
    this.pages = pages;
    this.rowData = pages.map(({ fields }) => fields);
    this.colDefs = this.buildPageColumns(pages);
  }

  private buildPageColumns(pages: AirtablePage[]): ColDef[] {
    const fieldNames = Array.from(
      new Set(pages.flatMap((page) => Object.keys(page.fields))),
    );

    return fieldNames.map((fieldName) => ({
      field: fieldName,
      headerName: fieldName,
      minWidth: 150,
      flex: 1,
      valueGetter: ({ data }) =>
        this.formatFieldValue((data as Record<string, unknown>)[fieldName]),
    }));
  }

  private formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.formatFieldValue(item))
        .filter(Boolean)
        .join(', ');
    }

    if (typeof value === 'object') {
      if ('name' in value) {
        return String(value.name ?? '');
      }

      if ('email' in value) {
        return String(value.email ?? '');
      }

      if ('filename' in value) {
        return String(value.filename ?? '');
      }

      if ('value' in value) {
        return this.formatFieldValue(value.value);
      }

      if ('state' in value) {
        return String(value.state ?? '');
      }
    }

    return JSON.stringify(value);
  }

  private handleError(error: unknown) {
    this.error =
      error instanceof Error ? error.message : 'Unable to load Airtable data';
    this.loading = false;
  }
}
