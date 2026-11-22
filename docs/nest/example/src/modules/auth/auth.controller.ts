import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { wrappedSchema } from '../../common/dto/pagination.schema.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AuthService } from './auth.service.js';
import * as authResponse from './dto/auth-response.schema.js';
import { type LoginInput, loginSchema } from './dto/login.schema.js';
import { type LogoutInput, logoutSchema } from './dto/logout.schema.js';
import { type RefreshTokenInput, refreshTokenSchema } from './dto/refresh-token.schema.js';
import { type RegisterInput, registerSchema } from './dto/register.schema.js';

const authResponseDoc = wrappedSchema(authResponse.authResponseSchema);
const logoutResponseDoc = wrappedSchema(z.object({ success: z.boolean() }));

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '注册并直接返回 access/refresh token' })
  @ApiOkResponse({ standardSchema: authResponseDoc })
  register(@Body({ schema: registerSchema }) dto: RegisterInput) {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: '邮箱密码登录' })
  @ApiOkResponse({ standardSchema: authResponseDoc })
  login(@Body({ schema: loginSchema }) dto: LoginInput) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: '用 refresh token 换新的一对 token（rotation）' })
  @ApiOkResponse({ standardSchema: authResponseDoc })
  refresh(@Body({ schema: refreshTokenSchema }) dto: RefreshTokenInput) {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @Post('logout')
  @ApiOperation({ summary: '登出，并撤销传入的 refresh token' })
  @ApiOkResponse({ standardSchema: logoutResponseDoc })
  logout(
    @CurrentUser() user: AuthUser,
    @Body({ schema: logoutSchema }) dto: LogoutInput,
  ) {
    return this.authService.logout(user.id, dto.refreshToken);
  }
}
