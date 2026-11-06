import { Module } from '@nestjs/common';
import { redisClientProvider } from './redis.provider.js';
import { RedisService } from './redis.service.js';

@Module({
  providers: [redisClientProvider, RedisService],
  exports: [RedisService],
})
export class RedisModule {}
