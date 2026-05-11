# YAML 配置文件方案

## YAML vs .env

```bash
# .env ——扁平键值对
DATABASE__HOST=localhost
DATABASE__PORT=3306
DATABASE__USERNAME=root
JWT__SECRET=xxx
JWT__EXPIRES_IN=2h
REDIS__HOST=localhost
REDIS__PORT=6379
# 嵌套靠双下划线——不够直观
```

```yaml
# config.yaml ——层次化结构
database:
  host: localhost
  port: 3306
  username: root
  password: password
  database: book_management

jwt:
  secret: xxx
  accessExpiresIn: 30m
  refreshExpiresIn: 7d

redis:
  host: localhost
  port: 6379
  password: ""

upload:
  maxFileSize: 5242880  # 5MB
  allowedTypes:
    - image/jpeg
    - image/png
    - image/webp
```

## 安装依赖

```bash
npm install js-yaml
npm install -D @types/js-yaml
```

## 实现 YAML 配置加载器

```typescript
// src/config/configuration.ts
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

export default () => {
  const env = process.env.NODE_ENV || 'development';

  // 加载环境对应的 YAML
  const configPath = join(__dirname, '../../config', `${env}.yaml`);
  const defaultPath = join(__dirname, '../../config', 'default.yaml');

  try {
    const envConfig = yaml.load(readFileSync(configPath, 'utf8')) as Record<string, any>;
    const defaultConfig = yaml.load(readFileSync(defaultPath, 'utf8')) as Record<string, any>;

    // 合并：环境配置覆盖默认配置
    return { ...defaultConfig, ...envConfig };
  } catch (error) {
    console.error(`配置加载失败: ${env}.yaml`);
    throw error;
  }
};
```

## 在 AppModule 中使用

```typescript
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // YAML 方案不依赖 .env，但可以共存
      ignoreEnvFile: true,
    }),
  ],
})
export class AppModule {}
```

## 使用时按路径访问

```typescript
@Injectable()
export class SomeService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    // YAML 嵌套结构 → 用点号路径访问
    const dbHost = this.configService.get<string>('database.host');
    const maxSize = this.configService.get<number>('upload.maxFileSize');
    const allowedTypes = this.configService.get<string[]>('upload.allowedTypes');
  }
}
```

## YAML vs .env 选择建议

| 维度 | YAML | .env |
|------|------|------|
| 可读性 | ✅ 层级分明 | ⚠️ 扁平，多了混乱 |
| 数组/对象 | ✅ 原生支持 | ❌ 只能字符串 |
| 多环境 | ✅ 一个环境一个文件 | ✅ 一个环境一个 .env |
| Docker/K8s 兼容 | ⚠️ 需要挂载文件 | ✅ 原生环境变量注入 |
| 生态系统 | ⚠️ 需要 js-yaml | ✅ 全生态支持 |
| 敏感信息 | ⚠️ 整个文件要保护 | ⚠️ 每个变量要保护 |

> 推荐：小型项目用 `.env`，配置复杂（数组、嵌套、多环境）时用 YAML。K8s/Docker 部署时用 ConfigMap/Secret 覆盖环境变量。

---

## 参考链接

- [NestJS — YAML Configuration](https://docs.nestjs.com/techniques/configuration#custom-configuration-files)
- [js-yaml — npm](https://www.npmjs.com/package/js-yaml)
