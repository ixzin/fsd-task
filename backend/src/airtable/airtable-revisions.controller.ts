import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AirtableRevisionsService } from './airtable-revisions.service';
import { RevisionCookieLoginDto } from './dto/revision-cookie-login.dto';
import { SyncRevisionsDto } from './dto/sync-revisions.dto';

@Controller('airtable')
export class AirtableRevisionsController {
  constructor(
    private readonly airtableRevisionsService: AirtableRevisionsService,
  ) { }

  @Post('revision-cookies/login')
  acquireRevisionCookies(@Body() dto: RevisionCookieLoginDto) {
    return this.airtableRevisionsService.acquireRevisionCookies(dto);
  }

  @Get('revision-cookies/valid')
  validateRevisionCookies(
    @Query('baseId') baseId?: string,
    @Query('tableId') tableId?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.airtableRevisionsService.validateRevisionCookies({
      baseId,
      tableId,
      recordId,
    });
  }

  @Post('revisions/sync')
  syncRevisionHistory(@Body() dto: SyncRevisionsDto) {
    return this.airtableRevisionsService.syncRevisionHistory(dto);
  }

  @Get('revisions')
  getStoredRevisions(
    @Query('baseId') baseId?: string,
    @Query('tableId') tableId?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.airtableRevisionsService.getStoredRevisions({
      baseId,
      tableId,
      recordId,
    });
  }
}
