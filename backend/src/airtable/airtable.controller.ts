import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { AirtableService } from './airtable.service';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { SyncAirtableDto } from './dto/sync-airtable.dto';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('airtable')
export class AirtableController {
  constructor(
    private readonly airtableService: AirtableService,
    private readonly configService: ConfigService,
  ) {}

  @Get('oauth/url')
  getOAuthUrl(@Query('state') state?: string) {
    return { url: this.airtableService.getOAuthUrl(state) };
  }

  @Get('oauth/callback')
  async handleOAuthCallback(
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ) {
    await this.airtableService.handleOAuthCallback(query.code, query.state);

    const frontEndUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    return res.redirect(`${frontEndUrl}/airtable/success`);
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
