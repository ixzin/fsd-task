export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel?: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId?: string;
}

export interface AirtablePage {
  _id?: string;
  baseId: string;
  tableId: string;
  tableName?: string;
  recordId: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface AirtableRevision {
  _id?: string;
  uuid: string;
  issueId: string;
  baseId: string;
  tableId: string;
  columnType: string;
  oldValue: string | null;
  newValue: string | null;
  createdDate: string;
  authoredBy?: string;
}

export interface AirtableSyncRequest {
  baseId?: string;
  tableId?: string;
}

export interface AirtableSyncResponse {
  basesCount: number;
  tablesCount: number;
  pagesCount: number;
}

export interface AirtableRevisionSyncResponse {
  pagesCount: number;
  revisionsCount: number;
  durationMs?: number;
  durationSeconds?: number;
}

export interface AuthData {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface RevisionCookieLoginResponse {
  cookiesCount?: number;
  sessionKey?: string;
}
