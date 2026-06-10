# nest new 命令详解

## 安装 Nest CLI

```bash
npm install -g @nestjs/cli
```

验证安装：

```bash
nest --version    # 11.x
nest --help       # 查看所有可用命令
```

## 创建第一个项目

```bash
nest new book-management-system-backend
```

执行后会让你选择包管理器和一些选项。推荐：

```
? Which package manager would you like to use?
  npm
  yarn
❯ pnpm        ← 推荐

? Would you like to generate a test file? (y/N)
❯ No          ← 我们会在实战日手动写关键测试

? Would you like to enable strict mode? (Y/n)
❯ Yes         ← TypeScript 严格模式
```

## nest new 全部选项速查

```bash
nest new <project-name> [options]

Options:
  --directory <path>       指定项目目录（默认=项目名）
  --skip-git               跳过 git init（已有 git 仓库时用）
  --skip-install           跳过依赖安装（离线环境或有特殊需求）
  --package-manager <pm>   指定包管理器：npm / yarn / pnpm
  --language <lang>        指定语言：TypeScript（默认）/ JavaScript
  --strict                 启用 TypeScript 严格模式（推荐）
```

常见组合：

```bash
# 最简创建（跳过 git、跳过安装，适合已有环境）
nest new my-app --skip-git --skip-install

# 指定用 pnpm（团队统一包管理器）
nest new my-app --package-manager pnpm

# 指定目录名不同于项目名
nest new my-app --directory backend
```

## 创建后生成的完整文件树

```
book-management-system-backend/
├── node_modules/               # 依赖
├── src/
│   ├── app.controller.ts       # 默认控制器
│   ├── app.controller.spec.ts  # 控制器测试（如果你没 skip）
│   ├── app.module.ts           # 根模块
│   ├── app.service.ts          # 默认服务
│   └── main.ts                 # 应用入口（bootstrap）
├── test/
│   ├── app.e2e-spec.ts         # E2E 测试
│   └── jest-e2e.json           # E2E 测试 Jest 配置
├── .eslintrc.js                # ESLint 配置
├── .prettierrc                 # Prettier 配置
├── nest-cli.json               # Nest CLI 配置
├── package.json                # 项目依赖和脚本
├── tsconfig.json               # TypeScript 编译配置
├── tsconfig.build.json         # 编译配置（排除测试文件）
└── README.md                   # 项目说明
```

## 核心文件逐行解读

### src/main.ts — 应用的入口

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // 1. 基于 AppModule 创建 Nest 应用实例
  const app = await NestFactory.create(AppModule);

  // 2. 监听 3000 端口
  await app.listen(process.env.PORT ?? 3000);

  // 3. 打印启动信息
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
```

`NestFactory.create(AppModule)` 是 Nest 的起点。它做的事情：
- 解析 AppModule 及其所有依赖
- 创建 IoC 容器
- 注册所有 Controller、Provider、Middleware
- 返回一个可用的 HTTP 应用实例

### src/app.module.ts — 应用的根模块

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],         // 引入其他模块（目前为空）
  controllers: [AppController],  // 注册控制器
  providers: [AppService],       // 注册服务
  exports: [],         // 导出给其他模块（目前不需要）
})
export class AppModule {}
```

AppModule 是整个应用的**组织起点**。后续所有业务模块（UserModule、BookModule）都会在 `imports` 中引入。

### src/app.controller.ts — 默认路由

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()          // 空路径 = 挂载在根路由 /
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()               // GET /
  getHello(): string {
    return this.appService.getHello();
  }
}
```

### src/app.service.ts — 默认服务

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

### 第一次运行

```bash
cd book-management-system-backend
pnpm run start:dev
```

看到以下输出表示成功：

```
[Nest] 12345  - 05/11/2026, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 05/11/2026, 10:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 05/11/2026, 10:00:00 AM     LOG [RoutesResolver] AppController {/}:
[Nest] 12345  - 05/11/2026, 10:00:00 AM     LOG [RouterExplorer] Mapped {/, GET} route
[Nest] 12345  - 05/11/2026, 10:00:00 AM     LOG [NestApplication] Nest application successfully started
```

浏览器访问 `http://localhost:3000`，看到 **Hello World!**。

## 启动命令详解

`package.json` 中的脚本：

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "format": "prettier --write \"src/**/*.ts\"",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
  }
}
```

| 命令 | 作用 | 使用场景 |
|------|------|---------|
| `nest start` | 启动应用（生产模式） | 本地运行编译后的代码 |
| `nest start --watch` | 启动 + 热重载（文件变化自动重启） | **日常开发** |
| `nest start --debug` | 启动 + 开启 Node.js debug 端口 | 调试 |
| `nest build` | 编译 TypeScript → dist/ | CI/CD 构建 |
| `node dist/main` | 直接运行编译产物 | 生产环境 |

> `start:dev` 是日常开发最常用的命令——修改代码自动重启，和前端 `vite dev` / `npm run serve` 一样的体验。

---

## 参考链接

- [NestJS — First Steps](https://docs.nestjs.com/first-steps)
- [NestJS CLI — new](https://docs.nestjs.com/cli/usages#nest-new)
- 开源笔记：《Nest 通关秘籍》.doc/3. Nest 基础概念扫盲.md
- 开源笔记：《Nest 通关秘籍》.doc/4. 快速掌握 Nest CLI.md
