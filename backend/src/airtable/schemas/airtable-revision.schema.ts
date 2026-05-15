import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirtableRevisionDocument = HydratedDocument<AirtableRevision>;

@Schema({ collection: 'airtable_revisions', timestamps: true })
export class AirtableRevision {
  @Prop({ required: true, index: true })
  uuid: string;

  @Prop({ required: true, index: true })
  issueId: string;

  @Prop({ required: true, index: true })
  baseId: string;

  @Prop({ required: true, index: true })
  tableId: string;

  @Prop({ required: true, index: true })
  columnType: string;

  @Prop()
  oldValue?: string;

  @Prop()
  newValue?: string;

  @Prop()
  createdDate?: Date;

  @Prop()
  authoredBy?: string;
}

export const AirtableRevisionSchema =
  SchemaFactory.createForClass(AirtableRevision);
AirtableRevisionSchema.index({ uuid: 1, issueId: 1 }, { unique: true });
