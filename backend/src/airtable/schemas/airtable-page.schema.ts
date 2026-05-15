import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AirtablePageDocument = HydratedDocument<AirtablePage>;

@Schema({ collection: 'airtable_pages', timestamps: true })
export class AirtablePage {
  @Prop({ required: true, index: true })
  baseId: string;

  @Prop({ required: true, index: true })
  tableId: string;

  @Prop({ required: true })
  tableName: string;

  @Prop({ required: true, index: true })
  recordId: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  fields: Record<string, unknown>;

  @Prop()
  createdTime?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  raw: Record<string, unknown>;
}

export const AirtablePageSchema = SchemaFactory.createForClass(AirtablePage);
AirtablePageSchema.index(
  { baseId: 1, tableId: 1, recordId: 1 },
  { unique: true },
);
