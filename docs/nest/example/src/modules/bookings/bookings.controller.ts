import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { paginatedSchema, wrappedSchema } from '../../common/dto/pagination.schema.js';
import { Role } from '../../common/enums.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { BookingsService } from './bookings.service.js';
import {
  bookingDetailResponseSchema,
  bookingResponseSchema,
} from './dto/booking-response.schema.js';
import { type CreateBookingInput, createBookingSchema } from './dto/create-booking.schema.js';
import { type QueryBookingsInput, queryBookingsSchema } from './dto/query-bookings.schema.js';
import { type RejectBookingInput, rejectBookingSchema } from './dto/reject-booking.schema.js';

const bookingDoc = wrappedSchema(bookingResponseSchema);
const bookingDetailDoc = wrappedSchema(bookingDetailResponseSchema);
const bookingListDoc = paginatedSchema(bookingDetailResponseSchema);

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: '创建预订（时间冲突校验）' })
  @ApiCreatedResponse({ standardSchema: bookingDoc })
  create(
    @Body({ schema: createBookingSchema }) dto: CreateBookingInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: '预订列表（普通用户只看自己的）' })
  @ApiOkResponse({ standardSchema: bookingListDoc })
  findAll(
    @Query({ schema: queryBookingsSchema }) query: QueryBookingsInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '预订详情' })
  @ApiOkResponse({ standardSchema: bookingDetailDoc })
  findOne(
    @Param('id', { schema: z.uuid() }) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.findOne(id, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  @ApiOperation({ summary: '审批通过（ADMIN）' })
  @ApiOkResponse({ standardSchema: bookingDoc })
  approve(@Param('id', { schema: z.uuid() }) id: string) {
    return this.bookingsService.approve(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/reject')
  @ApiOperation({ summary: '驳回预订（ADMIN）' })
  @ApiOkResponse({ standardSchema: bookingDoc })
  reject(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: rejectBookingSchema }) dto: RejectBookingInput,
  ) {
    return this.bookingsService.reject(id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: '取消预订（本人或 ADMIN）' })
  @ApiOkResponse({ standardSchema: bookingDoc })
  cancel(@Param('id', { schema: z.uuid() }) id: string, @CurrentUser() user: AuthUser) {
    return this.bookingsService.cancel(id, user);
  }
}
