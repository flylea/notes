import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums.js';
import { StatsService } from './stats.service.js';
import { StatsRangeQueryDto } from './dto/stats-range-query.dto.js';
import { TrendQueryDto } from './dto/trend-query.dto.js';

@ApiTags('stats')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: '总览统计（ADMIN，Redis 缓存 30s）' })
  overview() {
    return this.statsService.overview();
  }

  @Get('rooms/usage')
  @ApiOperation({ summary: '会议室使用率（ADMIN，Redis 缓存 60s）' })
  roomUsage(@Query() query: StatsRangeQueryDto) {
    return this.statsService.roomUsage(query);
  }

  @Get('bookings/trend')
  @ApiOperation({ summary: '预订趋势（ADMIN，Redis 缓存 60s）' })
  bookingTrend(@Query() query: TrendQueryDto) {
    return this.statsService.bookingTrend(query);
  }
}
