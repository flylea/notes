# 3 种方式调试 Nest 项目

## 为什么需要调试？

`console.log` 调试的局限：
- 无法查看变量在某个时刻的完整状态
- 无法逐步执行代码看执行路径
- 无法在运行时修改值测试不同分支
- 每次加 log 都要重启服务

断点调试可以：暂停在任何代码行 → 查看所有变量值 → 单步执行 → 甚至修改值。

## 方式一：VSCode 调试（推荐）

### 配置 launch.json

在项目根目录创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "restart": true,
      "autoAttachChildProcesses": true,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to NestJS",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### launch vs attach 的区别

| 模式 | 说明 | 适合场景 |
|------|------|---------|
| **launch** | VSCode 直接启动 Nest 进程并调试 | 日常开发（一步到位） |
| **attach** | 连接到已经在运行的 Node 调试进程 | 调试已在终端启动的服务、Docker 容器中的服务 |

### Attach 模式的使用步骤

1. 先在终端启动调试模式：
```bash
pnpm run start:debug
# 这会在 9229 端口开启调试监听
```

2. 然后在 VSCode 按 F5，选择 "Attach to NestJS"

> 如果你用 Docker 运行 Nest，attach 模式是最方便的——只需确保容器暴露了 9229 端口。

### 断点操作速查

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 设置断点 | F9（点击行号左侧） | 在此行暂停 |
| 条件断点 | 右键断点 → Edit Breakpoint → Expression | 条件满足时才暂停 |
| logpoint | 右键行号 → Add Logpoint | 不打暂停，只打印日志到控制台 |
| 继续执行 | F5 | 恢复执行到下个断点 |
| 单步跳过 | F10 | 执行当前行（不进入函数） |
| 单步进入 | F11 | 进入函数内部 |
| 单步跳出 | Shift+F11 | 跳出当前函数 |
| 查看变量 | 悬停鼠标 / Variables 面板 | 查看当前所有变量值 |
| 监视表达式 | Watch 面板 | 实时计算任意表达式 |
| 调试控制台 | Debug Console | 在当前上下文执行任意 JS 代码 |

> **logpoint 技巧**：不想改代码加 `console.log`？右键行号设置 logpoint，写 `用户ID：{userId}`，它会在控制台打印但不停下执行。等于**动态添加的 console.log**，不影响代码。

## 方式二：Chrome DevTools 调试

在终端启动：

```bash
node --inspect dist/main.js
```

或开发模式：
```bash
node --inspect-brk node_modules/.bin/nest start
```

然后在 Chrome 地址栏输入 `chrome://inspect`，点击 "Open dedicated DevTools for Node"。

Chrome DevTools 的 Node 调试器和你在前端调试用的一模一样——Source 面板打断点、Console 面板执行表达式、Network 面板看不到（因为没有浏览器 HTTP 请求，用 curl/Postman 代替）。

> `--inspect` 和 `--inspect-brk` 的区别：`--inspect-brk` 会在第一行代码自动暂停，让你有机会在代码开始执行前设置断点。

## 方式三：WebStorm / IntelliJ IDEA 调试

如果你用 JetBrains IDE：

1. 右键 `package.json` 中的 `start:dev` 脚本 → **Debug 'start:dev'**
2. 或者在 Run/Debug Configurations 中新建 Node.js 配置：
   - Node interpreter: 选择 Node.js 路径
   - Node parameters: `node_modules/.bin/nest start --debug --watch`
   - Working directory: 项目根目录
3. 点击 Debug 按钮（小虫子图标）

WebStorm 的调试体验是最好的——代码补全、重构、类型提示在调试时全部可用。

## 调试 Nest 特有的注意事项

### 1. 装饰器代码无法打断点

```typescript
@Controller('users')        // ← 装饰器代码是声明式的，没有运行时可停的点
export class UserController {
  @Get()                    // ← 同上
  findAll() {
    return 'hello';         // ← 断点打这里
  }
}
```

装饰器是**声明式的元数据**，在模块加载时执行，不在请求处理链路中。断点打在方法体内部。

### 2. async 方法中的断点

```typescript
@Get()
async findAll() {
  const users = await this.userService.findAll();  // ← 断点打这里
  return users;                                    // ← 或这里
}
```

`await` 那一行会暂停在 `await` 之前。如果想看 `users` 的值，在 `return` 行打断点。

### 3. 无法调试编译后的代码

Nest 是 TypeScript 编译成 JavaScript 后运行的。确保你的 `tsconfig.json` 有：

```json
{
  "compilerOptions": {
    "sourceMap": true  // 必须为 true！否则只能调试 JS 代码
  }
}
```

Nest CLI 生成的项目默认开启。如果没有 source map，VSCode 中的断点会显示为灰色（Unverified breakpoint），无法命中。

## 实战练习

1. 在 `app.controller.ts` 的 `getHello()` 方法里打断点
2. 用 VSCode launch 方式启动调试
3. 浏览器访问 `http://localhost:3000`
4. 代码暂停在断点，查看 `this.appService` 是什么
5. 在 Debug Console 中输入 `this.appService.getHello()` 看看返回值
6. F5 继续执行，浏览器收到响应

> 能在这个练习中成功暂停并查看变量，就说明调试环境完全 OK 了。

---

## 参考链接

- [Node.js — Debugging Guide](https://nodejs.org/en/learn/getting-started/debugging)
- [VSCode — Debugging TypeScript](https://code.visualstudio.com/docs/typescript/typescript-debugging)
- [NestJS — Debugging](https://docs.nestjs.com/recipes/debugging)
- [Chrome DevTools — Node.js Debugging](https://nodejs.org/en/learn/getting-started/debugging#inspector-clients)
- 开源笔记：《Nest 通关秘籍》.doc/7. 如何调试 Nest 项目.md
