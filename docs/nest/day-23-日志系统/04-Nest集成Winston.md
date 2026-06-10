# WinstonModule 集成 Nest

## 安装 nest-winston

```bash
npm install nest-winston winston winston-daily-rotate-file
```

## WinstonModule 配置

```typescript
// src/common/winston.module.ts
import { Module, Global } from '@nestjs/common';
import {
  WinstonModule as NestWinstonModule,
  utilities as nestWinstonUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Global()
@Module({
  imports: [
    NestWinstonModule.forRoot({
      // 开发环境——带颜色的可读格式
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        nestWinstonUtilities.format.nestLike('BookManagement', {
          colors: true,
          prettyPrint: true,
          processId: true,
        }),
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        }),
        // 生产环境——文件轮转
        ...(process.env.NODE_ENV === 'production'
          ? [
              new winston.transports.DailyRotateFile({
                filename: 'logs/app-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxSize: '20m',
                maxFiles: '30d',
                format: winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.json(),
                ),
              }),
            ]
          : []),
      ],
    }),
  ],
})
export class WinstonModule {}
```

## 替换 Nest 默认 Logger

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 用 Winston 替换 Nest 默认 Logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  await app.listen(3000);
}
bootstrap();
```

替换后，Nest 框架自身的日志也走 Winston：
```
[Nest] 12345  - 01/15/2024, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/15/2024, 10:30:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 01/15/2024, 10:30:01 AM     LOG [RoutesResolver] AppController {/}:
[Nest] 12345  - 01/15/2024, 10:30:01 AM     LOG [RouterExplorer] Mapped {/book/list, GET} route
```

## 在 Service 中使用 Winston

```typescript
// src/book/book.service.ts
import { Injectable, Logger } from '@nestjs/common';
// Logger 现在自动是 Winston，无需特殊导入

@Injectable()
export class BookService {
  private readonly logger = new Logger(BookService.name);

  async list(query: { page: number; size: number; keyword?: string }) {
    this.logger.log(`查询图书列表: page=${query.page}, keyword=${query.keyword}`);

    const startTime = Date.now();
    const result = await this.prisma.book.findMany(...);
    const duration = Date.now() - startTime;

    this.logger.log(`查询完成: 返回 ${result.length} 条, 耗时 ${duration}ms`);

    return result;
  }

  async create(dto: Prisma.BookCreateInput) {
    this.logger.log(`新增图书: ${dto.title}`);

    try {
      const book = await this.prisma.book.create({ data: dto });
      this.logger.log(`图书创建成功: id=${book.id}`);
      return book;
    } catch (error) {
      this.logger.error(`图书创建失败: ${dto.title}`, error.stack);
      throw error;
    }
  }
}
```

## 不同级别的日志使用场景

```typescript
@Injectable()
export class BorrowService {
  private readonly logger = new Logger(BorrowService.name);

  async borrowBook(userId: number, bookId: number) {
    // debug: 详细的调试信息（只有开发环境输出）
    this.logger.debug(`开始借阅流程: userId=${userId}, bookId=${bookId}`);

    try {
      const record = await this.prisma.$transaction(async (tx) => {
        // verbose: 更细粒度的跟踪信息
        this.logger.verbose(`事务内: 检查图书 ${bookId} 状态`);

        const book = await tx.book.findUnique({ where: { id: bookId } });

        if (book?.status === 'BORROWED') {
          // warn: 预期的业务失败
          this.logger.warn(`借阅失败: 图书 ${bookId} 已被借出`);
          throw new BadRequestException('该书已被借出');
        }

        return tx.borrowRecord.create({ ... });
      });

      // info: 关键业务操作成功
      this.logger.info(`借阅成功: user=${userId}, book=${bookId}, record=${record.id}`);
      return record;

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;  // 业务异常已经在上面 warn 过，不重复记录
      }

      // error: 系统错误——需要立即关注
      this.logger.error(
        `借阅异常: userId=${userId}, bookId=${bookId}`,
        error.stack,
      );
      throw error;
    }
  }
}
```

## 日志级别速查

```
使用场景                         → 级别
系统崩溃、数据库连接断开           → error  (必须立即处理)
Token 即将过期、磁盘空间不足       → warn   (需要关注但不紧急)
用户登录、借阅操作、关键业务流程    → info   (业务审计)
请求参数、SQL 语句（开发环境）      → debug  (开发调试)
非常详细的函数调用链（开发环境）    → verbose(几乎不用)
```

---

## 参考链接

- [nest-winston — npm](https://www.npmjs.com/package/nest-winston)
- [NestJS — Logger](https://docs.nestjs.com/techniques/logger#using-the-logger-for-application-logging)
