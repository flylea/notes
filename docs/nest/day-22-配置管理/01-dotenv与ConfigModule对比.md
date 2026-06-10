# dotenv 基础方案 vs @nestjs/config

## dotenv 基础方案

```typescript
// 纯 dotenv 方案
import * as dotenv from 'dotenv';
dotenv.config();  // 加载 .env 到 process.env

// 在代码中使用
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET || 'fallback';
const port = parseInt(process.env.PORT || '3000', 10);
```

问题：

```
1. 配置散落在各处——不知道项目用了哪些环境变量
2. 没有类型提示——process.env.XXX 都是 string | undefined
3. 手动处理默认值和类型转换
4. 多环境切换需要手动改文件
5. 配置错误要到运行时才发现（启动后才报错）
```

## @nestjs/config 方案

```bash
npm install @nestjs/config
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,         // 全局可用，无需在每个模块 import
      envFilePath: '.env',    // 指定配置文件路径
      ignoreEnvFile: false,   // 是否忽略 .env 文件
    }),
    // ... 其他模块
  ],
})
export class AppModule {}
```

## 对比

```typescript
// dotenv 方式
constructor() {
  this.dbHost = process.env.DB_HOST || 'localhost';
  this.dbPort = parseInt(process.env.DB_PORT || '3306', 10);
  this.dbUser = process.env.DB_USER || 'root';
  this.dbPass = process.env.DB_PASS || '';
}

// ConfigService 方式
constructor(private configService: ConfigService) {
  this.dbHost = this.configService.get('DB_HOST', 'localhost');
  this.dbPort = this.configService.get<number>('DB_PORT', 3306);
  this.dbUser = this.configService.get('DB_USER', 'root');
  this.dbPass = this.configService.get('DB_PASS', '');
}
```

| 维度 | dotenv | @nestjs/config |
|------|--------|---------------|
| 类型安全 | ❌ 全部 string | ⚠️ 泛型标注 |
| 默认值 | 手动 `\|\|` | `get('key', default)` |
| 多环境 | 手动管理 | `envFilePath` 数组 |
| DI 注入 | ❌ 全局变量 | ✅ Nest DI |
| 配置校验 | 不支持 | 支持 Joi |
| 测试友好 | ❌ 污染 process.env | ✅ 可 mock |
| 学习曲线 | 极低 | 低 |

## ConfigModule.forRoot 全部配置项

```typescript
ConfigModule.forRoot({
  isGlobal: true,              // 全局可用
  envFilePath: '.env',         // 单文件
  // envFilePath: ['.env.development', '.env'],  // 多文件（前面的优先级高）
  ignoreEnvFile: false,        // 是否忽略文件（生产环境可能用系统环境变量）
  ignoreEnvVars: false,        // 是否忽略系统环境变量
  load: [configuration],       // 自定义配置文件工厂函数
  validationSchema: joiSchema, // Joi 校验
  validationOptions: {          // 校验选项
    allowUnknown: true,
    abortEarly: false,
  },
  cache: true,                 // 缓存配置值（提升 get() 性能）
  expandVariables: true,       // 支持变量嵌套 ${VAR}
})
```

## 前端类比

```
dotenv = 在代码里直接 import 一个全局 JSON 对象
  → Vue: 把所有配置写在 window.__CONFIG__

@nestjs/config = 把配置通过 Vuex/Pinia 管理
  → Vue: 通过 provide/inject 注入配置
  → 类型安全、响应式、可测试
```

---

## 参考链接

- [NestJS — Configuration](https://docs.nestjs.com/techniques/configuration)
- [@nestjs/config — npm](https://www.npmjs.com/package/@nestjs/config)
- [dotenv — npm](https://www.npmjs.com/package/dotenv)
