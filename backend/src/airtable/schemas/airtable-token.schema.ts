import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirtableTokenDocument = HydratedDocument<AirtableToken>;

@Schema({ collection: 'airtable_tokens', timestamps: true })
export class AirtableToken {
  @Prop({ required: true, unique: true, index: true })
  providerUserId: string;

  @Prop({ required: true })
  accessToken: string;

  @Prop({ required: true })
  refreshToken: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: [String], default: [] })
  scopes: string[];
}

export const AirtableTokenSchema = SchemaFactory.createForClass(AirtableToken);
