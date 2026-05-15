import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirtableController } from './airtable.controller';
import { AirtableRevisionsController } from './airtable-revisions.controller';
import { AirtableRevisionsService } from './airtable-revisions.service';
import { AirtableService } from './airtable.service';
import {
  AirtablePage,
  AirtablePageSchema,
} from './schemas/airtable-page.schema';
import {
  AirtableRevisionCookie,
  AirtableRevisionCookieSchema,
} from './schemas/airtable-revision-cookie.schema';
import {
  AirtableRevision,
  AirtableRevisionSchema,
} from './schemas/airtable-revision.schema';
import {
  AirtableToken,
  AirtableTokenSchema,
} from './schemas/airtable-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AirtablePage.name, schema: AirtablePageSchema },
      { name: AirtableRevision.name, schema: AirtableRevisionSchema },
      {
        name: AirtableRevisionCookie.name,
        schema: AirtableRevisionCookieSchema,
      },
      { name: AirtableToken.name, schema: AirtableTokenSchema },
    ]),
  ],
  controllers: [AirtableController, AirtableRevisionsController],
  providers: [AirtableService, AirtableRevisionsService],
  exports: [AirtableService],
})
export class AirtableModule {}
