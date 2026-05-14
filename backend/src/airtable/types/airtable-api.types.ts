export type AirtableBase = {
  id: string;
  name: string;
  permissionLevel?: string;
};

export type AirtableTable = {
  id: string;
  name: string;
  primaryFieldId?: string;
  fields?: unknown[];
  views?: unknown[];
};

export type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

export type AirtableRecordsResponse = {
  records: AirtableRecord[];
  offset?: string;
};

export type AirtableTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

export type AirtableAccessToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};
