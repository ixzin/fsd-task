import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as cheerio from 'cheerio';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import puppeteer, { Page } from 'puppeteer';
import { RevisionCookieLoginDto } from './dto/revision-cookie-login.dto';
import { SyncRevisionsDto } from './dto/sync-revisions.dto';
import { AirtablePage } from './schemas/airtable-page.schema';
import { AirtableRevisionCookie } from './schemas/airtable-revision-cookie.schema';
import { AirtableRevision } from './schemas/airtable-revision.schema';
import type {
  AirtableRevisionActivityLike,
  ParsedAirtableRevision,
} from './types/airtable-revision.types';

const REVISION_COOKIE_SESSION_KEY = 'default';
const REVISION_REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class AirtableRevisionsService {
  private readonly logger = new Logger(AirtableRevisionsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(AirtablePage.name)
    private readonly airtablePageModel: Model<AirtablePage>,
    @InjectModel(AirtableRevision.name)
    private readonly airtableRevisionModel: Model<AirtableRevision>,
    @InjectModel(AirtableRevisionCookie.name)
    private readonly airtableRevisionCookieModel: Model<AirtableRevisionCookie>,
  ) { }

  async getStoredRevisions(filters: {
    baseId?: string;
    tableId?: string;
    recordId?: string;
  }) {
    const query: Record<string, string> = {};

    if (filters.baseId) {
      query.baseId = filters.baseId;
    }

    if (filters.tableId) {
      query.tableId = filters.tableId;
    }

    if (filters.recordId) {
      query.issueId = filters.recordId;
    }

    return this.airtableRevisionModel.find(query).lean();
  }

  async acquireRevisionCookies(dto: RevisionCookieLoginDto) {
    const headless =
      this.configService.get<string>('AIRTABLE_SCRAPER_HEADLESS', 'false') ===
      'true';
    const browser = await puppeteer.launch({ headless });
    const page = await browser.newPage();

    try {
      await page.goto(
        this.configService.getOrThrow<string>('AIRTABLE_LOGIN_URL'),
        { waitUntil: 'domcontentloaded' },
      );
      await this.typeIntoVisibleInput(
        page,
        '[data-testid="emailInput"], #emailLogin, input[type="email"], input[name="email"]',
        dto.email,
      );

      const submitButton = 'button[type="submit"]';

      await this.clickVisibleElement(page, submitButton);
      await this.typeIntoVisibleInput(
        page,
        'input[type="password"], input[name="password"]',
        dto.password,
      );
      await this.clickVisibleElement(page, submitButton);

      if (dto.mfaCode) {
        const mfaSelector =
          'input[autocomplete="one-time-code"], input[name*="code"], input[type="tel"], input[type="text"]';

        await this.typeIntoVisibleInput(page, mfaSelector, dto.mfaCode, 15_000);

        if (await this.hasVisibleElement(page, submitButton)) {
          await this.clickVisibleElement(page, submitButton);
        } else {
          await page.keyboard.press('Enter');
        }
      }

      await page
        .waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 10_000,
        })
        .catch(() => undefined);

      const cookies = await browser.defaultBrowserContext().cookies();
      const airtableCookies = cookies.filter((cookie) =>
        cookie.domain.includes('airtable.com'),
      );

      if (airtableCookies.length === 0) {
        throw new BadRequestException('No Airtable cookies were captured');
      }

      const cookieHeader = airtableCookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
      const savedCookies =
        await this.airtableRevisionCookieModel.findOneAndUpdate(
          { sessionKey: REVISION_COOKIE_SESSION_KEY },
          {
            $set: {
              sessionKey: REVISION_COOKIE_SESSION_KEY,
              cookieHeader,
              cookies: airtableCookies,
            },
          },
          { new: true, upsert: true },
        );

      return {
        cookiesCount: airtableCookies.length,
        sessionKey: savedCookies.sessionKey,
      };
    } catch (error) {
      throw error;
    } finally {
      await browser.close();
    }
  }

  async validateRevisionCookies(dto: SyncRevisionsDto = {}) {
    const samplePage = await this.findRevisionSamplePage(dto);
    const response = await this.fetchRevisionHistoryResponse(
      samplePage.baseId,
      samplePage.recordId,
    );
    const isValid = response.ok && !response.url.includes('/login');

    if (isValid) {
      await this.airtableRevisionCookieModel.updateOne(
        { sessionKey: REVISION_COOKIE_SESSION_KEY },
        { $set: { validatedAt: new Date() } },
      );
    }

    return {
      isValid,
      status: response.status,
      recordId: samplePage.recordId,
    };
  }

  async syncRevisionHistory(dto: SyncRevisionsDto = {}) {
    const startedAt = Date.now();
    const pages = await this.findPagesForRevisionSync(dto);
    let revisionsCount = 0;

    for (const [index, page] of pages.entries()) {
      this.logger.log(
        `Syncing Airtable revision history ${index + 1}/${pages.length}: ${page.recordId}`,
      );
      revisionsCount = await this.storeRevision(revisionsCount, page);
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `Synced Airtable revision history for ${pages.length} pages in ${durationMs}ms`,
    );

    return {
      pagesCount: pages.length,
      revisionsCount,
      durationSeconds: Number((durationMs / 1000).toFixed(2)),
    };
  }

  private async storeRevision(revisionsCount: number, page: AirtablePage) {
    const response = await this.fetchRevisionHistoryResponse(
      page.baseId,
      page.recordId,
    );

    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException(
        'Airtable revision cookies are expired or invalid',
      );
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Airtable revision request failed: ${response.status} ${await response.text()}`,
      );
    }

    const html = await response.text();
    const revisions = this.parseRevisionHistoryHtml(html, {
      baseId: page.baseId,
      tableId: page.tableId,
      recordId: page.recordId,
    });

    revisionsCount += revisions.length;
    await this.storeRevisions(
      page.baseId,
      page.tableId,
      page.recordId,
      revisions,
    );

    return revisionsCount;
  }

  private async findPagesForRevisionSync(dto: SyncRevisionsDto) {
    const query: Record<string, string> = {};

    if (dto.baseId) {
      query.baseId = dto.baseId;
    }

    if (dto.tableId) {
      query.tableId = dto.tableId;
    }

    if (dto.recordId) {
      query.recordId = dto.recordId;
    }

    const pageQuery = this.airtablePageModel.find(query).lean();

    if (dto.limit) {
      pageQuery.limit(dto.limit);
    }

    return pageQuery;
  }

  private async findRevisionSamplePage(dto: SyncRevisionsDto) {
    const [page] = await this.findPagesForRevisionSync({ ...dto, limit: 1 });

    if (!page) {
      throw new BadRequestException(
        'No Airtable pages found. Run /airtable/sync before checking revision cookies.',
      );
    }

    return page;
  }

  private async fetchRevisionHistoryResponse(baseId: string, recordId: string) {
    const cookieHeader = await this.getRevisionCookieHeader();
    const revisionUrl = new URL(
      this.configService
        .getOrThrow<string>('AIRTABLE_REVISION_HISTORY_URL')
        .replace('{recordId}', encodeURIComponent(recordId)),
    );
    const stringifiedObjectParams = JSON.stringify({
      limit: 10,
      offsetV2: null,
      shouldReturnDeserializedActivityItems: true,
      shouldIncludeRowActivityOrCommentUserObjById: true,
    });

    revisionUrl.searchParams.set(
      'stringifiedObjectParams',
      stringifiedObjectParams,
    );
    revisionUrl.searchParams.set('requestId', `req${randomUUID()}`);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REVISION_REQUEST_TIMEOUT_MS,
    );

    try {
      return await fetch(revisionUrl, {
        method: 'GET',
        headers: {
          Cookie: cookieHeader,
          'X-Airtable-Application-Id': baseId,
          'X-Time-Zone':
            this.configService.getOrThrow<string>('AIRTABLE_TIME_ZONE'),
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getRevisionCookieHeader() {
    const cookieSession = await this.airtableRevisionCookieModel.findOne({
      sessionKey: REVISION_COOKIE_SESSION_KEY,
    });

    if (!cookieSession) {
      throw new BadRequestException(
        'Airtable revision cookies are missing. Run /airtable/revision-cookies/login first.',
      );
    }

    return cookieSession.cookieHeader;
  }

  private parseRevisionHistoryHtml(
    body: string,
    page: { baseId: string; tableId: string; recordId: string },
  ) {
    return this.parseRevisionResponse(body, page);
  }

  private parseRevisionResponse(
    body: string,
    page: { baseId: string; tableId: string; recordId: string },
  ) {
    try {
      const response = JSON.parse(body) as {
        data?: {
          orderedActivityAndCommentIds?: string[];
          rowActivityInfoById?: Record<
            string,
            AirtableRevisionActivityLike & { diffRowHtml?: string }
          >;
        };
      };
      const ids = response.data?.orderedActivityAndCommentIds ?? [];
      const activities = response.data?.rowActivityInfoById ?? {};

      return ids.flatMap((activityId) =>
        this.parseActivityDiffHtml(activityId, activities[activityId], page),
      );
    } catch {
      return [];
    }
  }

  private parseActivityDiffHtml(
    activityId: string,
    activity:
      | (AirtableRevisionActivityLike & { diffRowHtml?: string })
      | undefined,
    page: { baseId: string; tableId: string; recordId: string },
  ) {
    if (!activity?.diffRowHtml) {
      return [];
    }

    const $ = cheerio.load(activity.diffRowHtml);
    const revisions: ParsedAirtableRevision[] = [];

    $('.historicalCellContainer').each((index, element) => {
      const fieldName = $(element).find('[columnId]').first().text().trim();

      // task requirements
      if (!/^(Status|Assignee)$/i.test(fieldName)) {
        return;
      }

      const oldValue = this.extractCellValue($, element, 'negative');
      const newValue = this.extractCellValue($, element, 'success');

      revisions.push({
        uuid: `${activityId}-${fieldName}-${index}`,
        issueId: page.recordId,
        baseId: page.baseId,
        tableId: page.tableId,
        columnType: fieldName,
        oldValue,
        newValue,
        createdDate: activity.createdTime
          ? new Date(activity.createdTime)
          : undefined,
        authoredBy: activity.originatingUserId,
      });
    });

    return revisions;
  }

  private extractCellValue(
    $: cheerio.CheerioAPI,
    element: Parameters<cheerio.CheerioAPI>[0],
    marker: 'negative' | 'success',
  ) {
    const markedValue = $(element)
      .find(
        `[class*="colors-background-${marker}"], [class*="border-${marker}"]`,
      )
      .last();

    if (markedValue.length > 0) {
      const title = markedValue.attr('title');

      if (title) {
        return title.trim();
      }

      const text = markedValue.text().replace(/\s+/g, ' ').trim();

      if (text) {
        return text;
      }
    }

    return undefined;
  }

  private async storeRevisions(
    baseId: string,
    tableId: string,
    recordId: string,
    revisions: ParsedAirtableRevision[],
  ) {
    await this.airtableRevisionModel.deleteMany({
      baseId,
      tableId,
      issueId: recordId,
    });

    if (revisions.length === 0) {
      return;
    }

    await this.airtableRevisionModel.bulkWrite(
      revisions.map((revision) => ({
        updateOne: {
          filter: { uuid: revision.uuid, issueId: revision.issueId },
          update: { $set: revision },
          upsert: true,
        },
      })),
    );
  }

  private async typeIntoVisibleInput(
    page: Page,
    selector: string,
    value: string,
    timeout = 30_000,
  ) {
    await page.waitForSelector(selector, { visible: true, timeout });
    await page.click(selector, { clickCount: 3 });
    await page.type(selector, value);
  }

  private async clickVisibleElement(page: Page, selector: string) {
    await page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    await page.click(selector);
  }

  private async hasVisibleElement(page: Page, selector: string) {
    const element = await page.$(selector);

    if (!element) {
      return false;
    }

    return element.isVisible();
  }
}
