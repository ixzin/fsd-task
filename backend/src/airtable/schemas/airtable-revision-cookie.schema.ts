import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AirtableRevisionCookieDocument =
  HydratedDocument<AirtableRevisionCookie>;

@Schema({ collection: 'airtable_revision_cookies', timestamps: true })
export class AirtableRevisionCookie {
  @Prop({ required: true, unique: true, index: true })
  sessionKey: string;

  @Prop({ required: true })
  cookieHeader: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  cookies: Record<string, unknown>[];

  @Prop()
  validatedAt?: Date;
}

export const AirtableRevisionCookieSchema = SchemaFactory.createForClass(
  AirtableRevisionCookie,
);
