import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

/**
 * Redis 访问薄封装。
 *
 * 设计目标：Redis 是“加速器”而不是“单点故障”。
 * 未配置、连接失败或命令报错时，所有方法都安静降级（返回 null / no-op），
 * 业务代码无需 try/catch。
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private available = false;

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  get isAvailable(): boolean {
    return this.available;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.warn('REDIS_URL 未配置，统计缓存将降级为直接查询数据库');
      return;
    }

    try {
      await this.client.connect();
      this.available = true;
      this.logger.log('Redis 已连接，统计缓存已启用');
    } catch (error) {
      this.available = false;
      this.logger.warn(`Redis 连接失败，缓存降级: ${this.describe(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (this.client.status === 'ready' || this.client.status === 'connect') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
    } catch (error) {
      this.logger.warn(`Redis 关闭失败: ${this.describe(error)}`);
      this.client.disconnect();
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.available || !this.client) {
      return null;
    }

    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`Redis GET ${key} 失败: ${this.describe(error)}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.available || !this.client) {
      return;
    }

    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis SET ${key} 失败: ${this.describe(error)}`);
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
