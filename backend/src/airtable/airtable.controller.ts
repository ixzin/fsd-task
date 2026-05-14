import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AirtableService } from './airtable.service';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { SyncAirtableDto } from './dto/sync-airtable.dto';

@Controller('airtable')
export class AirtableController {
  constructor(private readonly airtableService: AirtableService) {}

  @Get('oauth/url')
  getOAuthUrl(@Query('state') state?: string) {
    return { url: this.airtableService.getOAuthUrl(state) };
  }

  @Get('oauth/callback')
  handleOAuthCallback(@Query() query: OAuthCallbackDto) {
    return this.airtableService.handleOAuthCallback(query.code, query.state);
  }

  @Post('sync')
  sync(@Body() dto: SyncAirtableDto) {
    return this.airtableService.sync(dto);
  }

  @Get('bases')
  getBases() {
    return this.airtableService.getBases();
  }

  @Get('tables')
  getTables(@Query('baseId') baseId: string) {
    return this.airtableService.getTables(baseId);
  }

  @Get('users')
  getUsers(@Query('baseId') baseId: string) {
    return this.airtableService.getUsers(baseId);
  }

  @Get('pages')
  getStoredPages(
    @Query('baseId') baseId?: string,
    @Query('tableId') tableId?: string,
  ) {
    return this.airtableService.getStoredPages({ baseId, tableId });
  }
}
