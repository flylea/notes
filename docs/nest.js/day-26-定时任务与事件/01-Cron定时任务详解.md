# @Cron 定时任务详解

## 安装

```bash
npm install @nestjs/schedule
```

## 启用调度器

```typescript
// src/app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),  // ← 启用定时任务
    // ...其他模块
  ],
})
export class AppModule {}
```

## Cron 表达式

```
Cron 表达式有 6 位（Nest 默认支持 6 位，含秒）：

┌──────────── 秒 (0-59)
│ ┌────────── 分钟 (0-59)
│ │ ┌──────── 小时 (0-23)
│ │ │ ┌────── 日期 (1-31)
│ │ │ │ ┌──── 月份 (1-12)
│ │ │ │ │ ┌── 星期 (0-7, 0 和 7 都是周日)
│ │ │ │ │ │
* * * * * *

特殊字符：
  *    任意值
  */5  每 5 个单位
  1,3,5 第 1、3、5
  1-5   1 到 5
```

## @Cron 基础用法

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  // 每天凌晨 2 点执行
  @Cron('0 2 * * * *')
  handleDailyTask() {
    this.logger.log('执行每日统计任务...');
  }

  // 使用预定义表达式
  @Cron(CronExpression.EVERY_30_MINUTES)
  handleEvery30Minutes() {
    this.logger.log('每 30 分钟执行一次...');
  }

  // 每周一到周五上午 9 点
  @Cron('0 0 9 * * 1-5')
  handleWorkdayMorning() {
    this.logger.log('工作日早晨任务...');
  }
}
```

## CronExpression 预定义枚举

```typescript
import { CronExpression } from '@nestjs/schedule';

CronExpression.EVERY_SECOND       // 每秒
CronExpression.EVERY_30_SECONDS   // 每 30 秒
CronExpression.EVERY_MINUTE       // 每分钟
CronExpression.EVERY_5_MINUTES    // 每 5 分钟
CronExpression.EVERY_10_MINUTES   // 每 10 分钟
CronExpression.EVERY_30_MINUTES   // 每 30 分钟
CronExpression.EVERY_HOUR         // 每小时
CronExpression.EVERY_DAY_AT_MIDNIGHT   // 每天午夜
CronExpression.EVERY_DAY_AT_1AM        // 每天凌晨 1 点
CronExpression.EVERY_DAY_AT_2AM        // 每天凌晨 2 点
CronExpression.EVERY_WEEK               // 每周
CronExpression.EVERY_WEEKEND            // 每周末
CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT  // 每月 1 号午夜
CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_1AM        // 每月 1 号凌晨 1 点
```

## @Cron 完整参数

```typescript
@Cron('0 2 * * * *', {
  name: 'dailyStats',       // 任务名称（用于动态管理）
  timeZone: 'Asia/Shanghai', // 时区
  disabled: false,           // 是否禁用
})
handleDailyTask() {
  // 北京时间每天凌晨 2 点执行
}
```

## @Interval —— 按毫秒间隔执行

```typescript
@Injectable()
export class CacheCleanupService {
  // 每 10 分钟清理一次过期缓存
  @Interval('cacheCleanup', 10 * 60 * 1000)
  cleanExpiredCache() {
    this.logger.log('清理过期缓存...');
  }

  // 每 30 秒检查一次数据库连接
  @Interval(30000)
  checkDbConnection() {
    this.logger.debug('数据库连接正常');
  }
}
```

## @Timeout —— 延迟执行

```typescript
@Injectable()
export class StartupService {
  // 应用启动 5 秒后执行一次
  @Timeout('startupDelay', 5000)
  handleStartup() {
    this.logger.log('应用已启动，执行初始化任务...');
  }

  // 1 分钟后自动解锁超时的借阅锁
  @Timeout('unlockBorrow', 60 * 1000)
  unlockExpiredBorrowLocks() {
    // 处理异常情况：比如用户借书时服务崩溃
  }
}
```

## 前端类比

```
@Cron     = 类似 cron-job.org / GitHub Actions 的定时触发器
@Interval = 类似前端的 setInterval
@Timeout  = 类似前端的 setTimeout

区别：Nest 的这些装饰器是在服务端执行的，不依赖浏览器
```

---

## 参考链接

- [NestJS — Task Scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- [Crontab Guru — Editor](https://crontab.guru/)
