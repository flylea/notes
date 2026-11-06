import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  imports: [RedisModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
