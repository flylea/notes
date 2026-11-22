import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { paginatedSchema, wrappedSchema } from '../../common/dto/pagination.schema.js';
import { Role } from '../../common/enums.js';
import { type CreateRoomInput, createRoomSchema } from './dto/create-room.schema.js';
import { type QueryRoomsInput, queryRoomsSchema } from './dto/query-rooms.schema.js';
import { roomResponseSchema } from './dto/room-response.schema.js';
import { type UpdateRoomInput, updateRoomSchema } from './dto/update-room.schema.js';
import { RoomsService } from './rooms.service.js';

const roomDoc = wrappedSchema(roomResponseSchema);
const roomListDoc = paginatedSchema(roomResponseSchema);
const removedRoomDoc = wrappedSchema(
  z.object({ id: z.uuid(), deleted: z.literal(true) }),
);

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '会议室列表（登录前也可浏览）' })
  @ApiOkResponse({ standardSchema: roomListDoc })
  findAll(@Query({ schema: queryRoomsSchema }) query: QueryRoomsInput) {
    return this.roomsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '会议室详情' })
  @ApiOkResponse({ standardSchema: roomDoc })
  findOne(@Param('id', { schema: z.uuid() }) id: string) {
    return this.roomsService.findById(id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Post()
  @ApiOperation({ summary: '新建会议室（ADMIN）' })
  @ApiCreatedResponse({ standardSchema: roomDoc })
  create(@Body({ schema: createRoomSchema }) dto: CreateRoomInput) {
    return this.roomsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Patch(':id')
  @ApiOperation({ summary: '更新会议室（ADMIN）' })
  @ApiOkResponse({ standardSchema: roomDoc })
  update(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: updateRoomSchema }) dto: UpdateRoomInput,
  ) {
    return this.roomsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  @ApiOperation({ summary: '删除会议室（ADMIN，且不能有预订记录）' })
  @ApiOkResponse({ standardSchema: removedRoomDoc })
  remove(@Param('id', { schema: z.uuid() }) id: string) {
    return this.roomsService.remove(id);
  }
}
