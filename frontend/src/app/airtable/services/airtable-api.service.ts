import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  AirtableBase,
  AirtablePage,
  AirtableRevision,
  AirtableRevisionSyncResponse,
  AirtableSyncRequest,
  AirtableSyncResponse,
  AirtableTable,
  AuthData,
  RevisionCookieLoginResponse,
} from '../models/airtable.models';

@Injectable({
  providedIn: 'root',
})
export class AirtableApiService {
  private readonly apiUrl = 'http://localhost:3000/airtable';

  constructor(private readonly http: HttpClient) {}

  getBases() {
    return this.http.get<AirtableBase[]>(`${this.apiUrl}/bases`);
  }

  getTables(baseId: string) {
    return this.http.get<AirtableTable[]>(`${this.apiUrl}/tables`, {
      params: { baseId },
    });
  }

  getPages(filters: AirtableSyncRequest = {}) {
    return this.http.get<AirtablePage[]>(`${this.apiUrl}/pages`, {
      params: this.buildParams(filters),
    });
  }

  getRevisions(filters: AirtableSyncRequest = {}) {
    return this.http.get<AirtableRevision[]>(`${this.apiUrl}/revisions`, {
      params: this.buildParams(filters),
    });
  }

  loginRevisionCookies(params: AuthData) {
    return this.http.post<RevisionCookieLoginResponse>(`${this.apiUrl}/revision-cookies/login`, params);
  }

  syncPages(body: AirtableSyncRequest) {
    return this.http.post<AirtableSyncResponse>(`${this.apiUrl}/sync`, body);
  }

  syncRevisions(body: AirtableSyncRequest) {
    return this.http.post<AirtableRevisionSyncResponse>(
      `${this.apiUrl}/revisions/sync`,
      body,
    );
  }

  getOAuthUrl() {
    return this.http.get<{url: string}>(`${this.apiUrl}/oauth/url`);
  }

  private buildParams(filters: AirtableSyncRequest) {
    let params = new HttpParams();

    if (filters.baseId) {
      params = params.set('baseId', filters.baseId);
    }

    if (filters.tableId) {
      params = params.set('tableId', filters.tableId);
    }

    return params;
  }
}
