# Prisma 异常码处理

## Prisma 的异常类型

```typescript
import { Prisma } from '@prisma/client';

// 1. PrismaClientKnownRequestError — 已知错误（约束冲突、记录不存在等）
// 2. PrismaClientUnknownRequestError — 未知错误
// 3. PrismaClientValidationError — Schema 校验失败（开发阶段）
// 4. PrismaClientInitializationError — 连接失败
```

## 常见错误码

```typescript
import { Prisma } from '@prisma/client';

try {
  await this.prisma.user.create({ data: { username: 'john' } });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // 唯一约束冲突
        throw new BadRequestException('用户名已被注册');
      case 'P2025': // 记录不存在
        throw new NotFoundException('用户不存在');
      case 'P2003': // 外键约束失败
        throw new BadRequestException('关联数据不存在');
      case 'P2014': // 嵌套关系冲突
        throw new BadRequestException('操作违反了关系约束');
    }
  }
  throw error;
}
```

## 关键错误码速查

| Code | 含义 | 示例 |
|------|------|------|
| `P2002` | 唯一约束冲突 | 用户名或邮箱重复 |
| `P2003` | 外键约束失败 | 删除有借阅记录的书 |
| `P2025` | 操作影响 0 条记录 | 更新/删除不存在的 ID |
| `P2014` | 嵌套关系冲突 | 创建用户时 book 外键无效 |
| `P2016` | 查询返回 null | 需要返回单条记录的查询无结果 |
| `P2024` | 连接超时 | 数据库不可达 |

## 优雅处理：封装到 ExceptionFilter

在 Day 11 的兜底过滤器中加入 Prisma 处理：

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const messages = {
        P2002: '该记录已存在',
        P2025: '记录不存在',
        P2003: '关联数据不存在，操作被拒绝',
      };

      return response.status(400).json({
        code: exception.code === 'P2025' ? 404 : 400,
        message: messages[exception.code] || '数据库操作失败',
      });
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return response.status(503).json({
        code: 503,
        message: '数据库连接失败，请稍后重试',
      });
    }

    // ... 其他异常处理
  }
}
```

## 在 Service 中统一封装

```typescript
// src/common/utils/prisma-error.ts
import { Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

export function handlePrismaError(error: unknown, customMessages?: Record<string, string>): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const messages = {
      P2002: '该记录已存在',
      P2025: '记录不存在',
      P2003: '关联数据不存在',
      ...customMessages,
    };

    const message = messages[error.code] || '数据库操作失败';
    const status = error.code === 'P2025' ? 404 : 400;

    if (status === 404) throw new NotFoundException(message);
    throw new BadRequestException(message);
  }
  throw error;
}

// 使用
async register(dto: RegisterUserDto) {
  try {
    return await this.prisma.user.create({ data: dto });
  } catch (error) {
    handlePrismaError(error, {
      P2002: `用户名 "${dto.username}" 已被注册`,
    });
  }
}
```

---

## 参考链接

- [Prisma — Error Reference](https://www.prisma.io/docs/reference/api-reference/error-reference)
- [Prisma — Handling Exceptions](https://www.prisma.io/docs/concepts/components/prisma-client/handling-exceptions)
