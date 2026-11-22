import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { paginatedSchema, wrappedSchema } from '../../common/dto/pagination.schema.js';
import { Role } from '../../common/enums.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { type QueryUsersInput, queryUsersSchema } from './dto/query-users.schema.js';
import { type UpdateProfileInput, updateProfileSchema } from './dto/update-profile.schema.js';
import { type UpdateUserInput, updateUserSchema } from './dto/update-user.schema.js';
import { userResponseSchema } from './dto/user-response.schema.js';
import { UsersService } from './users.service.js';

const userDoc = wrappedSchema(userResponseSchema);
const userListDoc = paginatedSchema(userResponseSchema);

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '当前登录用户信息' })
  @ApiOkResponse({ standardSchema: userDoc })
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findByIdOrFail(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: '修改自己的资料' })
  @ApiOkResponse({ standardSchema: userDoc })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body({ schema: updateProfileSchema }) dto: UpdateProfileInput,
  ) {
    return this.usersService.update(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '用户列表（管理员）' })
  @ApiOkResponse({ standardSchema: userListDoc })
  findAll(@Query({ schema: queryUsersSchema }) query: QueryUsersInput) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '用户详情（管理员）' })
  @ApiOkResponse({ standardSchema: userDoc })
  findOne(@Param('id', { schema: z.uuid() }) id: string) {
    return this.usersService.findByIdOrFail(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '修改用户（管理员）' })
  @ApiOkResponse({ standardSchema: userDoc })
  update(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: updateUserSchema }) dto: UpdateUserInput,
  ) {
    return this.usersService.update(id, dto);
  }
}
