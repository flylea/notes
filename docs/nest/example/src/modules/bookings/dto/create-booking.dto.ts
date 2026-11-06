import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid', description: '会议室 ID' })
  @IsUUID()
  roomId: string;

  @ApiProperty({ example: '2026-11-20T09:00:00+08:00', description: 'ISO 8601 开始时间' })
  @IsISO8601({ strict: true })
  startTime: string;

  @ApiProperty({ example: '2026-11-20T10:30:00+08:00', description: 'ISO 8601 结束时间' })
  @IsISO8601({ strict: true })
  endTime: string;

  @ApiPropertyOptional({ maxLength: 500, example: '周会' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
