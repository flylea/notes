# Redis 缓存用户权限

## 为什么需要 Redis 缓存

```
每次请求都查 3 张关联表（UserRole → Role → RolePermission → Permission）
    → 至少 4 次数据库查询
    → 高并发下数据库压力巨大

用 Redis 缓存：
    → 登录时加载一次，写入 Redis
    → 后续请求直接读 Redis
    → 角色变更时清除 Redis 缓存
```

## 缓存架构

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  PermissionGuard                                  │
│    │                                              │
│    ▼                                              │
│  查 Redis                                         │
│    │                                              │
│    ├── 命中 → 直接返回权限列表                       │
│    │                                              │
│    └── 未命中 → 查 MySQL                           │
│                  │                                │
│                  ▼                                │
│              写入 Redis（TTL 5 分钟）                │
│                  │                                │
│                  ▼                                │
│              返回权限列表                           │
│                                                   │
│  Redis Key 设计：                                   │
│  user:permissions:<userId> → ["book:read", ...]   │
│                                                   │
└─────────────────────────────────────────────────┘
```

## 安装 Redis 客户端

```bash
npm install ioredis
npm install -D @types/ioredis  # 如果使用 TypeScript < 5.0
```

## RedisService 封装

```typescript
// src/redis/redis.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => this.logger.log('Redis 连接成功'));
    this.client.on('error', (err) => this.logger.error('Redis 错误:', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // 基础操作
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  // 专门用于权限缓存
  async getUserPermissions(userId: number): Promise<string[] | null> {
    const cached = await this.get(`user:permissions:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setUserPermissions(userId: number, permissions: string[], ttlSeconds = 300) {
    await this.set(`user:permissions:${userId}`, JSON.stringify(permissions), ttlSeconds);
  }

  async clearUserPermissions(userId: number) {
    await this.del(`user:permissions:${userId}`);
  }

  // 批量清除——角色变更时清除所有相关用户的权限缓存
  async clearRoleUsersCache(roleId: number) {
    // 查找拥有该角色的所有用户
    const userIds = await this.getRoleUserIds(roleId);
    const keys = userIds.map(id => `user:permissions:${id}`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
```

## 升级 PermissionGuard—集成 Redis

```typescript
// src/auth/permission.guard.ts（Redis 版）
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,  // ← 注入 Redis
  ) {}

  private async getUserPermissions(userId: number): Promise<string[]> {
    // 1. 查 Redis 缓存
    const cached = await this.redis.getUserPermissions(userId);
    if (cached) {
      return cached;
    }

    // 2. 缓存未命中——查数据库
    const permissions = await this.loadPermissionsFromDB(userId);

    // 3. 写入 Redis（5 分钟过期）
    await this.redis.setUserPermissions(userId, permissions, 300);

    return permissions;
  }
}
```

## Redis 缓存失效策略

```typescript
// 角色变更时，必须清除相关用户的权限缓存

// src/role/role.service.ts
@Injectable()
export class RoleService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // 给用户分配角色
  async assignRole(userId: number, roleId: number) {
    await this.prisma.userRole.create({
      data: { userId, roleId },
    });
    // 清除该用户的权限缓存
    await this.redis.clearUserPermissions(userId);
  }

  // 从用户移除角色
  async removeRole(userId: number, roleId: number) {
    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
    await this.redis.clearUserPermissions(userId);
  }

  // 给角色添加权限
  async grantPermission(roleId: number, permissionId: number) {
    await this.prisma.rolePermission.create({
      data: { roleId, permissionId },
    });
    // 清除拥有该角色的所有用户的缓存
    await this.redis.clearRoleUsersCache(roleId);
  }
}
```

## 无 Redis 时的降级策略

```typescript
// 开发环境可能没有 Redis——优雅降级
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    @Optional() private redis?: RedisService,  // ← 可选注入
  ) {}

  private async getUserPermissions(userId: number): Promise<string[]> {
    // 有 Redis 优先用 Redis
    if (this.redis) {
      try {
        const cached = await this.redis.getUserPermissions(userId);
        if (cached) return cached;

        const permissions = await this.loadPermissionsFromDB(userId);
        await this.redis.setUserPermissions(userId, permissions, 300);
        return permissions;
      } catch (error) {
        // Redis 挂了——降级为直接查数据库
        console.warn('Redis 不可用，回退到数据库查询');
      }
    }

    // 无 Redis 或 Redis 不可用——直接查数据库
    return this.loadPermissionsFromDB(userId);
  }
}
```

> 缓存策略总结：「读缓存未命中 → 查数据库 → 写缓存」是经典模式。角色/权限变更时必须主动清除相关缓存，这点最容易被忽略。

---

## 参考链接

- [Redis — Documentation](https://redis.io/docs/latest/)
- [ioredis — npm](https://www.npmjs.com/package/ioredis)
- [NestJS — Optional Providers](https://docs.nestjs.com/providers#optional-providers)
