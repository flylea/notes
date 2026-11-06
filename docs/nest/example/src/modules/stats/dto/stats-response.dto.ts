import { ApiProperty } from '@nestjs/swagger';

export class StatsOverviewDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  totalRooms: number;

  @ApiProperty()
  totalBookings: number;

  @ApiProperty()
  pendingBookings: number;

  @ApiProperty()
  approvedBookings: number;

  @ApiProperty({ description: '统计生成时间（缓存命中时是写入缓存的时间）' })
  generatedAt: string;
}

export class RoomUsageItemDto {
  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  capacity: number;

  @ApiProperty({ description: '区间内已通过的预订数' })
  bookingCount: number;

  @ApiProperty({ description: '区间内已通过的预订总时长（分钟）' })
  bookedMinutes: number;

  @ApiProperty({ description: '已预订时长 / 区间总时长，百分比（保留 1 位小数）' })
  utilizationRate: number;
}

export class StatsRangeDto {
  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;
}

export class RoomUsageDto {
  @ApiProperty({ type: StatsRangeDto })
  range: StatsRangeDto;

  @ApiProperty()
  totalRooms: number;

  @ApiProperty({ type: [RoomUsageItemDto] })
  rooms: RoomUsageItemDto[];
}

export class BookingTrendItemDto {
  @ApiProperty({ example: '2026-11-01' })
  date: string;

  @ApiProperty()
  count: number;
}

export class BookingTrendDto {
  @ApiProperty()
  days: number;

  @ApiProperty({ type: [BookingTrendItemDto] })
  items: BookingTrendItemDto[];
}
