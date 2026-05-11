# Nest 中封装 ioredis

## 优化版 RedisService

Day 21 的 RedisService 是简化版。这里是生产级的完整封装：

```typescript
// src/redis/redis.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host,
      port,
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Redis 连接重试 (第 ${times} 次)，${delay}ms 后重试`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,  // 连接断开时不缓存命令
    });

    this.client.on('connect', () => this.logger.log('Redis 连接成功'));
    this.client.on('error', (err) => this.logger.error('Redis 错误', err.stack));
    this.client.on('close', () => this.logger.warn('Redis 连接关闭'));

    // 健康检查
    await this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis 连接已断开');
  }

  // ==================== 完整 API 封装 ====================

  // String
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // Hash
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hsetMultiple(key: string, data: Record<string, string>): Promise<void> {
    await this.client.hset(key, data);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetAll(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  // Set
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  // Sorted Set
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    return this.client.zincrby(key, increment, member);
  }

  async zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores = false,
  ): Promise<string[]> {
    if (withScores) {
      return this.client.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return this.client.zrevrange(key, start, stop);
  }

  // List
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  // 批量操作（Pipeline——减少网络往返）
  async executePipeline(commands: Array<[string, ...any[]]>): Promise<any[]> {
    const pipeline = this.client.pipeline();
    for (const [cmd, ...args] of commands) {
      (pipeline as any)[cmd](...args);
    }
    return pipeline.exec();
  }

  // Lock——分布式锁
  async lock(key: string, ttlSeconds = 30): Promise<string | null> {
    const token = Math.random().toString(36).slice(2);
    const result = await this.client.set(
      `lock:${key}`,
      token,
      'EX',
      ttlSeconds,
      'NX',  // 只有 key 不存在时才设置
    );
    return result === 'OK' ? token : null;
  }

  async unlock(key: string, token: string): Promise<boolean> {
    // Lua 脚本保证原子性
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, `lock:${key}`, token);
    return result === 1;
  }
}
```

## RedisModule

```typescript
// src/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

---

## 参考链接

- [ioredis — GitHub](https://github.com/redis/ioredis)
- [Redis — Commands](https://redis.io/commands/)
