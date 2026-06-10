# Nest CLI 命令完整速查

## nest generate — 代码生成器

`nest generate`（简写 `nest g`）是 Nest CLI 的核心功能。它根据模板生成骨架代码，避免手写重复的样板。

### 基础语法

```bash
nest g <schematic> <name> [options]

# 简写
nest g <schematic> <name>
```

### 全部 Schematic 速查表

| Schematic | 简写 | 生成的文件 | 用法 |
|-----------|------|-----------|------|
| `module` | `mo` | `xxx.module.ts` | 模块（组织单元） |
| `controller` | `co` | `xxx.controller.ts` | 控制器（路由处理） |
| `service` | `s` | `xxx.service.ts` | 服务（业务逻辑） |
| `resource` | `res` | module + controller + service + dto + entities | **一键生成全套 CRUD** |
| `guard` | `gu` | `xxx.guard.ts` | 权限守卫 |
| `interceptor` | `itc` | `xxx.interceptor.ts` | 拦截器 |
| `pipe` | `pi` | `xxx.pipe.ts` | 参数管道 |
| `filter` | `f` | `xxx.filter.ts` | 异常过滤器 |
| `decorator` | `d` | `xxx.decorator.ts` | 自定义装饰器 |
| `middleware` | `mi` | `xxx.middleware.ts` | 中间件 |
| `class` | `cl` | `xxx.ts` | 普通类 |
| `gateway` | `ga` | `xxx.gateway.ts` | WebSocket 网关 |

### 常用选项

```bash
nest g service user --flat       # 不创建子文件夹（直接放在当前目录）
nest g service user --no-spec    # 跳过测试文件生成
nest g service user --dry-run    # 预览会生成什么，不实际创建

# 常用组合：干净、无测试、平铺
nest g service user --flat --no-spec
nest g resource user --no-spec   # 资源生成最常用
```

### resource 生成详解

```bash
nest g resource book --no-spec
```

执行后会问两个问题：

```
? What transport layer do you use?
  REST API         ← 选这个
  GraphQL (code first)
  GraphQL (schema first)
  Microservice (non-HTTP)
  WebSockets

? Would you like to generate CRUD entry points? (Y/n)
❯ Yes              ← 自动生成全套 CRUD 方法
```

生成的文件结构：

```
src/book/
├── book.module.ts       # Book 模块
├── book.controller.ts   # Book 控制器（含 CRUD 路由）
├── book.service.ts      # Book 服务（含 CRUD 方法）
├── dto/
│   ├── create-book.dto.ts
│   └── update-book.dto.ts
└── entities/
    └── book.entity.ts
```

### 指定生成路径

```bash
# 生成到 src/user/ 下
nest g service user/user-profile --flat --no-spec

# 生成到 src/common/ 下
nest g guard common/auth --flat --no-spec
```

## nest build — 编译构建

```bash
nest build

# 选项
nest build --webpack              # 使用 webpack 编译（支持热重载插件）
nest build --tsc                  # 使用 tsc 编译（默认）
nest build --watch                # 监控模式（文件变化自动编译）
nest build --path tsconfig.build.json  # 指定 tsconfig
```

### tsc vs webpack 构建

| 特性 | tsc | webpack |
|------|-----|---------|
| 编译方式 | 文件到文件 | 打包成 bundle |
| 速度 | 中等 | 比 tsc 快 2-4x |
| 热重载 | --watch | HMR（热模块替换） |
| tree-shaking | 否 | 是 |
| 调试 | source-map 直接可用 | 需要配置 devtool |
| 推荐场景 | 开发 | 生产部署 |

Nest 默认用 tsc。如果你追求启动速度，可以用 webpack：

```bash
nest build --webpack
node dist/main
```

## nest start — 启动应用

```bash
nest start                    # 普通启动
nest start --watch            # 热重载启动（= start:dev）
nest start --debug            # 调试模式启动（= start:debug）
nest start --prod             # 生产模式（= start:prod）

# 组合使用
nest start --watch --debug    # 热重载 + 调试
```

## nest info — 诊断信息

```bash
nest info
```

输出当前项目的环境信息，排查问题时很有用：

```
[System Information]
OS Version     : Windows 11 Pro
NodeJS Version : v22.14.0
NPM Version    : 10.9.2

[Nest CLI]
Nest CLI Version : 11.0.5

[Nest Platform Information]
platform-express version : 11.0.5
common version           : 11.0.5
core version             : 11.0.5
```

> `nest info` 在提 GitHub Issue 或问 Stack Overflow 时通常需要贴出来，用于复现环境。

## 手动添加文件到 Module

`nest g` 生成文件后，如果你选择了 `--flat`（不经过 module 自动注册），需要手动在 Module 中注册：

```typescript
// 需要在 user.module.ts 中手动添加
@Module({
  controllers: [UserController],  // 添加新 Controller
  providers: [UserService],       // 添加新 Service
  exports: [UserService],         // 如果其他模块要用
})
export class UserModule {}
```

`nest g resource` 会自动做好这一步。`nest g service --flat` 需要手动操作。

## 常用工作流

```bash
# 1. 创建新功能模块
nest g resource product --no-spec

# 2. 如果只需要 Service（比如工具类）
nest g service common/file-upload --flat --no-spec
# 然后在需要的 module 中手动添加 providers

# 3. 创建 Guard
nest g guard common/auth --flat --no-spec
# 在需要的 controller 或 module 中通过 @UseGuards() 引用
```

---

## 参考链接

- [NestJS CLI — Overview](https://docs.nestjs.com/cli/overview)
- [NestJS CLI — generate](https://docs.nestjs.com/cli/usages#nest-generate)
- [NestJS CLI — build](https://docs.nestjs.com/cli/usages#nest-build)
- [NestJS CLI — start](https://docs.nestjs.com/cli/usages#nest-start)
- 开源笔记：《Nest 通关秘籍》.doc/4. 快速掌握 Nest CLI.md
