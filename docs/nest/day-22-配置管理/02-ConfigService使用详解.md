# ConfigService 使用详解

## 基本用法

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });
  }
}
```

## 核心 API

### `get(key, defaultValue?)`

```typescript
// 基础取值
const dbHost = this.configService.get('DB_HOST');           // string | undefined
const dbPort = this.configService.get<number>('DB_PORT');   // 指定类型

// 带默认值
const port = this.configService.get('PORT', 3000);          // 默认 3000
const env = this.configService.get('NODE_ENV', 'development');
const jwtSecret = this.configService.get(
  'JWT_SECRET',
  'dev-secret-do-not-use-in-production',  // 仅开发用的兜底值
);
```

### `getOrThrow(key)`

```typescript
// 必需配置——取不到直接报错
const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
// DATABASE_URL 不存在 → 启动失败，而不是运行时 undefined 报错
```

### 配置路径嵌套

```typescript
// .env 文件
DATABASE__HOST=localhost     // 双下划线表示嵌套
DATABASE__PORT=3306

// 在代码中
const dbHost = this.configService.get('DATABASE.HOST');  // 'localhost'
const dbPort = this.configService.get('DATABASE.PORT');  // '3306'

// 或使用点号写法
const dbHost = this.configService.get('database.host');  // 不区分大小写
```

## 在各类 Provider 中使用

### 在 Service 中

```typescript
@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(private configService: ConfigService) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
  }
}
```

### 在动态模块中

```typescript
@Module({})
export class JwtModule {
  static register() {
    return {
      module: JwtModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'JWT_OPTIONS',
          useFactory: (configService: ConfigService) => ({
            secret: configService.getOrThrow('JWT_SECRET'),
            expiresIn: configService.get('JWT_EXPIRES_IN', '2h'),
          }),
          inject: [ConfigService],
        },
      ],
    };
  }
}
```

### 在 main.ts 中

```typescript
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3000);
  await app.listen(port);
}
```

## 图书管理系统中的用法

```typescript
// src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: { url: configService.getOrThrow<string>('DATABASE_URL') },
      },
    });
  }
}

// src/auth/jwt.module.ts
JwtModule.registerAsync({
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow('JWT_SECRET'),
    signOptions: {
      expiresIn: config.get('JWT_ACCESS_EXPIRES_IN', '2h'),
      issuer: 'book-management-api',
    },
  }),
  inject: [ConfigService],
})

// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get('PORT', 3000);

  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
```

## get vs getOrThrow

```typescript
// get — 安全取值，适合有默认值的配置
const port = this.configService.get('PORT', 3000);

// getOrThrow — 必需配置，取不到应该阻止启动
const dbUrl = this.configService.getOrThrow<string>('DATABASE_URL');
// 生产环境数据库 URL 未配置 → 启动就报错 → 优于运行时各种 undefined 崩溃
```

> 指南：数据库连接、JWT 密钥等**必需配置**用 `getOrThrow`。端口、日志级别等**有合理默认值**的用 `get`。

---

## 参考链接

- [NestJS — ConfigService](https://docs.nestjs.com/techniques/configuration#using-the-configservice)
- [NestJS — Custom Configuration](https://docs.nestjs.com/techniques/configuration#custom-configuration-files)
