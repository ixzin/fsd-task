export type ParsedAirtableRevision = {
  uuid: string;
  issueId: string;
  baseId: string;
  tableId: string;
  columnType: string;
  oldValue?: string;
  newValue?: string;
  createdDate?: Date;
  authoredBy?: string;
};

export type AirtableRevisionActivityLike = {
  uuid?: string;
  id?: string;
  activityId?: string;
  issueId?: string;
  recordId?: string;
  rowId?: string;
  columnType?: string;
  fieldName?: string;
  columnName?: string;
  oldValue?: unknown;
  previousValue?: unknown;
  newValue?: unknown;
  currentValue?: unknown;
  createdDate?: string;
  createdTime?: string;
  authoredBy?: string;
  originatingUserId?: string;
};
