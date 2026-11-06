import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Role } from '../../common/enums.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { QueryBookingsDto } from './dto/query-bookings.dto.js';
import { RejectBookingDto } from './dto/reject-booking.dto.js';

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: '创建预订（时间冲突校验）' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookingsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: '预订列表（普通用户只看自己的）' })
  findAll(@Query() query: QueryBookingsDto, @CurrentUser() user: AuthUser) {
    return this.bookingsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '预订详情' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.findOne(id, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  @ApiOperation({ summary: '审批通过（ADMIN）' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.approve(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/reject')
  @ApiOperation({ summary: '驳回预订（ADMIN）' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectBookingDto) {
    return this.bookingsService.reject(id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: '取消预订（本人或 ADMIN）' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.cancel(id, user);
  }
}
