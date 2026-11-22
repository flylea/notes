import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { wrappedSchema } from '../../common/dto/pagination.schema.js';
import { Role } from '../../common/enums.js';
import { StatsService } from './stats.service.js';
import {
  bookingTrendSchema,
  roomUsageSchema,
  statsOverviewSchema,
} from './dto/stats-response.schema.js';
import {
  type StatsRangeQueryInput,
  statsRangeQuerySchema,
} from './dto/stats-range-query.schema.js';
import { type TrendQueryInput, trendQuerySchema } from './dto/trend-query.schema.js';

const overviewDoc = wrappedSchema(statsOverviewSchema);
const roomUsageDoc = wrappedSchema(roomUsageSchema);
const bookingTrendDoc = wrappedSchema(bookingTrendSchema);

@ApiTags('stats')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: '总览统计（ADMIN，Redis 缓存 30s）' })
  @ApiOkResponse({ standardSchema: overviewDoc })
  overview() {
    return this.statsService.overview();
  }

  @Get('rooms/usage')
  @ApiOperation({ summary: '会议室使用率（ADMIN，Redis 缓存 60s）' })
  @ApiOkResponse({ standardSchema: roomUsageDoc })
  roomUsage(@Query({ schema: statsRangeQuerySchema }) query: StatsRangeQueryInput) {
    return this.statsService.roomUsage(query);
  }

  @Get('bookings/trend')
  @ApiOperation({ summary: '预订趋势（ADMIN，Redis 缓存 60s）' })
  @ApiOkResponse({ standardSchema: bookingTrendDoc })
  bookingTrend(@Query({ schema: trendQuerySchema }) query: TrendQueryInput) {
    return this.statsService.bookingTrend(query);
  }
}
