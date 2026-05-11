# SchedulerRegistry 动态管理定时任务

## 为什么需要动态管理

```
静态 @Cron 的问题：
  - 应用启动后定时任务就固定了
  - 无法根据配置动态启停
  - 无法在运行时添加/删除任务
  - 无法获取任务状态

SchedulerRegistry 让你可以：
  - 获取所有定时任务
  - 动态启动/停止某个任务
  - 动态添加新的定时任务
```

## SchedulerRegistry API

```typescript
import { Injectable } from '@nestjs/common';
import { SchedulerRegistry, CronJob } from '@nestjs/schedule';
import { CronJob as CronJobClass } from 'cron';

@Injectable()
export class DynamicTaskService {
  constructor(private schedulerRegistry: SchedulerRegistry) {}

  // 列出所有 CronJob
  listAllJobs() {
    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervals = this.schedulerRegistry.getIntervals();
    const timeouts = this.schedulerRegistry.getTimeouts();

    return {
      cronJobs: Array.from(cronJobs.keys()),     // ['dailyStats', 'cleanupJob']
      intervals: Array.from(intervals.keys()),   // ['cacheCleanup']
      timeouts: Array.from(timeouts.keys()),     // ['startupDelay']
    };
  }

  // 获取特定任务
  getJob(name: string) {
    return this.schedulerRegistry.getCronJob(name);
  }

  // 暂停任务
  pauseJob(name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.stop();
    console.log(`任务 ${name} 已暂停`);
  }

  // 恢复任务
  resumeJob(name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.start();
    console.log(`任务 ${name} 已恢复`);
  }

  // 删除任务
  deleteJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
    console.log(`任务 ${name} 已删除`);
  }

  // 动态添加任务
  addJob(name: string, cronTime: string, callback: () => void) {
    const job = new CronJobClass(cronTime, callback);
    this.schedulerRegistry.addCronJob(name, job as any);
    job.start();
    console.log(`任务 ${name} 已添加，cron: ${cronTime}`);
  }
}
```

## 实战：根据配置动态启停

```typescript
// src/tasks/book-stats.service.ts
@Injectable()
export class BookStatsService {
  private readonly logger = new Logger(BookStatsService.name);

  constructor(
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
    private configService: ConfigService,
  ) {
    // 根据配置决定是否启用统计任务
    const statsEnabled = this.configService.get('ENABLE_STATS', 'true') === 'true';
    if (!statsEnabled) {
      this.schedulerRegistry.getCronJob('dailyStats')?.stop();
      this.logger.warn('统计任务已禁用');
    }
  }

  @Cron('0 2 * * * *', { name: 'dailyStats' })
  async calculateDailyStats() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 统计昨日数据
    const [newUsers, newBorrows, newReturns] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      this.prisma.borrowRecord.count({
        where: { borrowedAt: { gte: yesterday, lt: today } },
      }),
      this.prisma.borrowRecord.count({
        where: { returnedAt: { gte: yesterday, lt: today } },
      }),
    ]);

    this.logger.log(`昨日统计：新增用户 ${newUsers}，借阅 ${newBorrows}，归还 ${newReturns}`);
  }
}
```

## 通过 API 控制定时任务

```typescript
// src/admin/admin.controller.ts
@Controller('admin/tasks')
export class AdminTaskController {
  constructor(private dynamicTaskService: DynamicTaskService) {}

  @Get()
  listTasks() {
    return this.dynamicTaskService.listAllJobs();
  }

  @Post('pause')
  pauseTask(@Body('name') name: string) {
    this.dynamicTaskService.pauseJob(name);
    return { success: true, message: `${name} 已暂停` };
  }

  @Post('resume')
  resumeTask(@Body('name') name: string) {
    this.dynamicTaskService.resumeJob(name);
    return { success: true, message: `${name} 已恢复` };
  }
}
```

---

## 参考链接

- [NestJS — Dynamic Scheduling](https://docs.nestjs.com/techniques/task-scheduling#dynamic-scheduling)
- [cron — npm](https://www.npmjs.com/package/cron)
