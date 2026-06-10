# Winston 核心概念：Logger / Transport / Format

## 三大核心

```
┌──────────────────────────────────────────────┐
│                                               │
│   Logger ── Container                         │
│     │                                         │
│     ├── Transport 1: Console                  │
│     │    └── Format: colorize + timestamp     │
│     │                                         │
│     ├── Transport 2: File (error.log)         │
│     │    └── Format: JSON + timestamp         │
│     │    └── Level: error                     │
│     │                                         │
│     └── Transport 3: File (combined.log)      │
│          └── Format: JSON + timestamp         │
│                                               │
└──────────────────────────────────────────────┘
```

## Logger——日志器

```typescript
import { createLogger, transports, format } from 'winston';

const logger = createLogger({
  level: 'info',                    // 最低记录级别
  format: format.combine(           // 格式组合
    format.timestamp(),
    format.json(),
  ),
  transports: [                     // 输出目标
    new transports.Console(),
    new transports.File({ filename: 'app.log' }),
  ],
});

// 使用
logger.info('用户登录成功', { userId: 1 });
logger.error('数据库连接失败', { error: 'Connection refused' });
```

## Transport——输出目标

```typescript
import { transports } from 'winston';

const logger = createLogger({
  transports: [
    // 控制台输出
    new transports.Console({
      level: 'debug',          // 开发环境看所有日志
      format: format.combine(
        format.colorize(),     // 彩色输出
        format.simple(),       // 简洁格式
      ),
    }),

    // 文件输出——错误日志
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',          // 只记录 error 级别
      maxsize: 5242880,        // 5MB 自动切分
      maxFiles: 10,            // 最多保留 10 个文件
    }),

    // 文件输出——所有日志
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 20,
    }),

    // HTTP 上报——发送到日志服务
    new transports.Http({
      host: 'log-collector.internal',
      port: 8080,
      path: '/ingest',
      ssl: true,
    }),
  ],
});
```

## Format——格式化

```typescript
import { format } from 'winston';

// 常用 Format
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // 时间戳
  format.errors({ stack: true }),                        // 错误堆栈
  format.splat(),                                         // 支持 %s %d 占位符
  format.json(),                                          // JSON 格式
);

// 开发环境——人类可读
const devFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}] ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  }),
);

// 生产环境——JSON 结构化
const prodFormat = format.combine(
  format.timestamp(),
  format.json(),
);
```

## 日志级别

```
Winston 默认级别（从高到低）：

error:   0   — 系统错误，需要立即关注（数据库挂了）
warn:    1   — 警告，潜在问题（Token 即将过期）
info:    2   — 关键业务流程（用户登录、借书、还书）
http:    3   — HTTP 请求日志
verbose: 4   — 详细信息（调试用）
debug:   5   — 调试信息（开发环境）
silly:   6   — 所有信息（几乎不用）

// 设置 level 后，只会记录该级别及以上的日志
logger.level = 'info';   // 记录 info、warn、error
logger.level = 'debug';  // 记录所有
```

## 在图书管理系统中的应用

```typescript
// src/common/logger.ts
import { createLogger, transports, format } from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

export const winstonLogger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    isProduction ? format.json() : format.combine(
      format.colorize(),
      format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length
          ? ` ${JSON.stringify(meta)}`
          : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      }),
    ),
  ),
  transports: [
    new transports.Console(),
    // 生产环境写文件
    ...(isProduction ? [
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
      new transports.File({ filename: 'logs/combined.log' }),
    ] : []),
  ],
});
```

---

## 参考链接

- [Winston — Transports](https://github.com/winstonjs/winston#transports)
- [Winston — Formats](https://github.com/winstonjs/winston#formats)
- [Winston — Log Levels](https://github.com/winstonjs/winston#logging-levels)
