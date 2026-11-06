import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { JwtPayload } from '../../common/types/auth-user.js';
import { RedisService } from '../../redis/redis.service.js';
import { UsersService, type UserRow } from '../users/users.service.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';

const BCRYPT_ROUNDS = 10;
const REVOKED_PREFIX = 'auth:revoked:';

/** 签发 token 只需要这几个字段，避免依赖具体的查询结果类型。 */
type TokenUser = Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'avatarUrl'>;

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('jwt.accessSecret');
    this.accessExpiresIn = config.getOrThrow<string>('jwt.accessExpiresIn');
    this.refreshSecret = config.getOrThrow<string>('jwt.refreshSecret');
    this.refreshExpiresIn = config.getOrThrow<string>('jwt.refreshExpiresIn');
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    return this.issueTokens(user);
  }

  /**
   * refresh token rotation：校验旧 token → 签发新 token → 撤销旧 token。
   * 撤销记录写入 Redis；Redis 不可用时退化为“仅过期失效”，README 已说明。
   */
  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('token 类型不正确');
    }
    if (payload.jti && (await this.redis.getJson<boolean>(`${REVOKED_PREFIX}${payload.jti}`))) {
      throw new UnauthorizedException('refresh token 已失效，请重新登录');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const result = await this.issueTokens(user);
    await this.revoke(payload);
    return result;
  }

  async logout(userId: string, refreshToken?: string): Promise<{ success: true }> {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
          secret: this.refreshSecret,
        });
        if (payload.sub === userId) {
          await this.revoke(payload);
        }
      } catch {
        // 过期或非法的 refresh token 无需撤销。
      }
    }
    return { success: true };
  }

  private async issueTokens(user: TokenUser): Promise<AuthResponseDto> {
    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(
      { ...basePayload, type: 'access' },
      {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, type: 'refresh', jti: randomUUID() },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  private async revoke(payload: JwtPayload): Promise<void> {
    if (!payload.jti) {
      return;
    }
    const ttl = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
    if (ttl <= 0) {
      return;
    }
    await this.redis.setJson(`${REVOKED_PREFIX}${payload.jti}`, true, ttl);
  }
}
