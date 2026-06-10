# SQL 日志配置

## 为什么需要 SQL 日志？

开发阶段看到 Prisma 发出的实际 SQL，能帮助你：
1. 发现 N+1 查询问题
2. 理解 Prisma 如何翻译你的 API 调用
3. 优化慢查询

## 基础配置

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

日志级别：
| 级别 | 内容 |
|------|------|
| `query` | 所有 SQL 语句 + 参数 + 耗时 |
| `info` | 一般信息（如连接成功） |
| `warn` | 警告（如缺失索引） |
| `error` | 错误 |

输出示例：
```
prisma:query SELECT `books`.`id`, `books`.`title` FROM `books` WHERE `books`.`price` > ? LIMIT ? OFFSET ?
prisma:query Parameters: [50, 10, 0]
prisma:query Duration: 2ms
```

## 开发环境详细配置

```typescript
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'stdout' },          // 查询日志输出到控制台
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});
```

## 自定义日志处理（emit: 'event'）

```typescript
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },  // 用事件方式处理
  ],
});

// 监听查询事件
prisma.$on('query', (e) => {
  console.log('Query:', e.query);
  console.log('Params:', e.params);
  console.log('Duration:', e.duration, 'ms');
  console.log('---');
});
```

在 Nest 中（Day 17 详讲）：

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
      ],
    });

    // 慢查询预警
    this.$on('query', (e: any) => {
      if (e.duration > 1000) {
        console.warn(`SLOW QUERY: ${e.query} (${e.duration}ms)`);
      }
    });
  }
}
```

## 生产环境

```typescript
const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
    // 不输出 query → 避免日志刷屏 + 性能开销
  ],
});
```

> 开发阶段打开 query 日志，生产环境只保留 warn/error。SQL 日志是你理解 ORM 工作原理的最佳窗口。

---

## 参考链接

- [Prisma — Logging](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/logging)
- [Prisma — Debugging](https://www.prisma.io/docs/guides/performance-and-optimization/debugging)
