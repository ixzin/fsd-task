import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import {
  AIRTABLE_MAX_PAGES,
  AIRTABLE_PAGE_SIZE,
  DEFAULT_PROVIDER_USER_ID,
} from './config/airtable.config';
import { SyncAirtableDto } from './dto/sync-airtable.dto';
import { AirtablePage } from './schemas/airtable-page.schema';
import { AirtableToken } from './schemas/airtable-token.schema';
import type {
  AirtableAccessToken,
  AirtableBase,
  AirtableRecord,
  AirtableRecordsResponse,
  AirtableTable,
  AirtableTokenResponse,
} from './types/airtable-api.types';

@Injectable()
export class AirtableService {
  private readonly oauthCodeVerifiers = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(AirtablePage.name)
    private readonly airtablePageModel: Model<AirtablePage>,
    @InjectModel(AirtableToken.name)
    private readonly airtableTokenModel: Model<AirtableToken>,
  ) {}

  getOAuthUrl(state: string = randomUUID()) {
    const clientId = this.configService.getOrThrow<string>('AIRTABLE_CLIENT_ID');
    const redirectUri = this.configService.getOrThrow<string>(
      'AIRTABLE_REDIRECT_URI',
    );
    const scopes = this.configService
      .getOrThrow<string>('AIRTABLE_SCOPES')
      .split(/\s+/)
      .filter(Boolean);
    const { codeChallenge, codeVerifier } = this.createPkcePair();
    const url = new URL(
      this.configService.getOrThrow<string>('AIRTABLE_AUTHORIZE_URL'),
    );

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    this.oauthCodeVerifiers.set(state, codeVerifier);

    return url.toString();
  }

  async handleOAuthCallback(code?: string, state?: string) {
    if (!code) {
      throw new BadRequestException('Missing Airtable OAuth code');
    }

    if (!state) {
      throw new BadRequestException('Missing Airtable OAuth state');
    }

    const codeVerifier = this.oauthCodeVerifiers.get(state);

    if (!codeVerifier) {
      throw new BadRequestException(
        'Missing OAuth code verifier for this state. Generate a new OAuth URL and try again.',
      );
    }

    this.oauthCodeVerifiers.delete(state);

    const token = await this.exchangeCodeForToken(code, codeVerifier);
    const savedToken = await this.saveToken(DEFAULT_PROVIDER_USER_ID, token);

    return {
      providerUserId: savedToken.providerUserId,
      expiresAt: savedToken.expiresAt,
      scopes: savedToken.scopes,
    };
  }

  async sync(dto: SyncAirtableDto = {}) {
    const bases = dto.baseId
      ? [{ id: dto.baseId, name: dto.baseId }]
      : await this.getBases();
    let tablesCount = 0;
    let pagesCount = 0;

    for (const base of bases) {
      const tables = dto.tableId
        ? [{ id: dto.tableId, name: dto.tableId }]
        : await this.getTables(base.id);

      tablesCount += tables.length;

      for (const table of tables) {
        const records = await this.getAllRecords(base.id, table.id);

        pagesCount += records.length;
        await this.storePages(base.id, table, records);
      }
    }

    return {
      basesCount: bases.length,
      tablesCount,
      pagesCount,
    };
  }

  async getBases() {
    const response = await this.airtableRequest<{ bases: AirtableBase[] }>(
      '/meta/bases',
    );

    return response.bases;
  }

  async getTables(baseId: string) {
    const response = await this.airtableRequest<{ tables: AirtableTable[] }>(
      `/meta/bases/${encodeURIComponent(baseId)}/tables`,
    );

    return response.tables;
  }

  async getUsers(baseId: string) {
    return this.getAllRecords(baseId, 'Users');
  }

  async getStoredPages(filters: { baseId?: string; tableId?: string }) {
    const query: Record<string, string> = {};

    if (filters.baseId) {
      query.baseId = filters.baseId;
    }

    if (filters.tableId) {
      query.tableId = filters.tableId;
    }

    return this.airtablePageModel.find(query).lean();
  }

  private async getAllRecords(baseId: string, tableId: string) {
    const records: AirtableRecord[] = [];
    let response = await this.getRecordsPage(baseId, tableId);
    let page = 1;

    records.push(...response.records);

    while (response.offset) {
      if (++page > AIRTABLE_MAX_PAGES) {
        throw new InternalServerErrorException(
          'Too many Airtable pages. Pagination may be stuck.',
        );
      }

      response = await this.getRecordsPage(baseId, tableId, response.offset);
      records.push(...response.records);
    }

    return records;
  }

  private getRecordsPage(baseId: string, tableId: string, offset?: string) {
    const searchParams = new URLSearchParams({
      pageSize: AIRTABLE_PAGE_SIZE.toString(),
    });

    if (offset) {
      searchParams.set('offset', offset);
    }

    return this.airtableRequest<AirtableRecordsResponse>(
      `/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}?${searchParams.toString()}`,
    );
  }

  private async storePages(
    baseId: string,
    table: Pick<AirtableTable, 'id' | 'name'>,
    records: AirtableRecord[],
  ) {
    if (records.length === 0) {
      await this.airtablePageModel.deleteMany({
        baseId,
        tableId: table.id,
      });
      return;
    }

    await this.airtablePageModel.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { baseId, tableId: table.id, recordId: record.id },
          update: {
            $set: {
              baseId,
              tableId: table.id,
              tableName: table.name,
              recordId: record.id,
              fields: record.fields,
              createdTime: record.createdTime
                ? new Date(record.createdTime)
                : undefined,
              raw: record,
            },
          },
          upsert: true,
        },
      })),
    );

    await this.airtablePageModel.deleteMany({
      baseId,
      tableId: table.id,
      recordId: { $nin: records.map((record) => record.id) },
    });
  }

  private async airtableRequest<T>(
    path: string,
    retried = false,
  ): Promise<T> {
    const token = await this.getValidToken();
    const apiBaseUrl = this.configService.getOrThrow<string>(
      'AIRTABLE_API_BASE_URL',
    );
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (response.status === 401 && !retried && token.refreshToken) {
      await this.refreshToken(DEFAULT_PROVIDER_USER_ID, token.refreshToken);
      return this.airtableRequest<T>(path, true);
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Airtable request failed: ${response.status} ${await response.text()}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async getValidToken(): Promise<AirtableAccessToken> {
    const providerUserId = DEFAULT_PROVIDER_USER_ID;
    const token = await this.airtableTokenModel.findOne({ providerUserId });

    if (!token) {
      const accessToken = this.configService.get<string>('AIRTABLE_ACCESS_TOKEN');

      if (accessToken) {
        return { accessToken };
      }
    }

    if (!token) {
      throw new BadRequestException('Airtable account is not connected');
    }

    if (token.expiresAt.getTime() <= Date.now() + 60_000) {
      return this.refreshToken(providerUserId, token.refreshToken);
    }

    return token;
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string) {
    const redirectUri = this.configService.getOrThrow<string>(
      'AIRTABLE_REDIRECT_URI',
    );

    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
  }

  private async refreshToken(providerUserId: string, refreshToken: string) {
    const token = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    return this.saveToken(providerUserId, token);
  }

  private async requestToken(body: Record<string, string>) {
    const clientId = this.configService.getOrThrow<string>('AIRTABLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'AIRTABLE_CLIENT_SECRET',
    );
    const tokenUrl = this.configService.getOrThrow<string>(
      'AIRTABLE_TOKEN_URL',
    );
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Airtable token request failed: ${response.status} ${await response.text()}`,
      );
    }

    return response.json() as Promise<AirtableTokenResponse>;
  }

  private async saveToken(providerUserId: string, token: AirtableTokenResponse) {
    return this.airtableTokenModel.findOneAndUpdate(
      { providerUserId },
      {
        $set: {
          providerUserId,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: new Date(Date.now() + token.expires_in * 1000),
          scopes: token.scope?.split(/\s+/).filter(Boolean) ?? [],
        },
      },
      { new: true, upsert: true },
    );
  }

  private createPkcePair() {
    const codeVerifier = randomBytes(64).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeChallenge, codeVerifier };
  }
}
