import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirtableController } from './airtable.controller';
import { AirtableService } from './airtable.service';
import { AirtablePage, AirtablePageSchema } from './schemas/airtable-page.schema';
import {
  AirtableToken,
  AirtableTokenSchema,
} from './schemas/airtable-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AirtablePage.name, schema: AirtablePageSchema },
      { name: AirtableToken.name, schema: AirtableTokenSchema },
    ]),
  ],
  controllers: [AirtableController],
  providers: [AirtableService],
  exports: [AirtableService],
})
export class AirtableModule {}
