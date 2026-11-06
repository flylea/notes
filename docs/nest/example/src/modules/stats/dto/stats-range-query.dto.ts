import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class StatsRangeQueryDto {
  @ApiPropertyOptional({ description: '统计开始时间（ISO 8601），默认 7 天前' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ description: '统计结束时间（ISO 8601），默认当前时间' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
