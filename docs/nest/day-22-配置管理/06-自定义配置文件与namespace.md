# 自定义配置文件与 namespace

## 为什么需要 namespace

当配置越来越多时，全局 `configService.get('database.host')` 看起来不错，但：
- 不知道有哪些配置键可用
- 没有类型安全
- 不同模块的配置混在一起

**namespace 将配置按模块分组，提供类型安全。**

## 注册 namespace

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'book_management',
}));
```

```typescript
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'dev-secret',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: 'book-management-api',
}));
```

```typescript
// src/config/redis.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
}));
```

```typescript
// src/config/upload.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('upload', () => ({
  maxFileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
  allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  dest: process.env.UPLOAD_DEST || './uploads',
}));
```

## 在 AppModule 中注册所有 namespace

```typescript
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import uploadConfig from './config/upload.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        jwtConfig,
        redisConfig,
        uploadConfig,
      ],
      validationSchema: Joi.object({
        // 仍然可以用 Joi 校验系统环境变量
        NODE_ENV: Joi.string().valid('development', 'production'),
      }),
    }),
  ],
})
export class AppModule {}
```

## 使用带 namespace 的配置

```typescript
@Injectable()
export class PrismaService {
  constructor(private configService: ConfigService) {
    // 获取 database namespace 的配置
    const dbConfig = configService.get('database');
    // { host: 'localhost', port: 3306, username: 'root', ... }

    const dbHost = configService.get<string>('database.host');
    // 'localhost'
  }
}

@Injectable()
export class JwtConfigService {
  constructor(private configService: ConfigService) {
    const jwtConfig = this.configService.get('jwt');
    // { secret: '...', accessExpiresIn: '30m', ... }
  }
}
```

## 类型安全的配置注入

```typescript
// 定义配置类型
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// 创建类型安全的配置 token
export const DATABASE_CONFIG = 'DATABASE_CONFIG';

// 在 Provider 中注入部分配置
@Module({
  providers: [
    {
      provide: DATABASE_CONFIG,
      useFactory: (configService: ConfigService) =>
        configService.get<DatabaseConfig>('database'),
      inject: [ConfigService],
    },
  ],
})

// 使用
@Injectable()
export class SomeService {
  constructor(
    @Inject(DATABASE_CONFIG) private dbConfig: DatabaseConfig,
  ) {
    // dbConfig.host  — 有类型提示！
    // dbConfig.port  — 有类型提示！
  }
}
```

## namespace 分离的好处

```
没有 namespace：                  有 namespace：
configService.get('DB_HOST')     configService.get('database.host')
configService.get('DB_PORT')     configService.get('database.port')
configService.get('DB_USER')     configService.get('database.username')
configService.get('JWT_SECRET')  configService.get('jwt.secret')
configService.get('REDIS_HOST')  configService.get('redis.host')

大量平铺的键                       按模块有序分组
                              database.xxx
                              jwt.xxx
                              redis.xxx
                              upload.xxx
```

## 配置管理最佳实践总结

```
1. config/ 目录集中管理所有配置
   ├── database.config.ts
   ├── jwt.config.ts
   ├── redis.config.ts
   └── upload.config.ts

2. registerAs('namespace', ...) 分组隔离

3. 必需配置用 getOrThrow，可选配置用 get(defaultValue)

4. 生产敏感信息通过系统环境变量注入

5. Joi 校验防止配置错误

6. .env.example 提交到 Git，.env 绝不提交

7. 配置值缓存在 constructor 中：
   constructor(config: ConfigService) {
     this.jwtSecret = config.getOrThrow('jwt.secret'); // 只读一次
   }
```

---

## 参考链接

- [NestJS — Configuration Namespaces](https://docs.nestjs.com/techniques/configuration#configuration-namespaces)
- [NestJS — Partial Registration](https://docs.nestjs.com/techniques/configuration#partial-registration)
