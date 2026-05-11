# Module / Controller / Service 的 MVC 职责划分

## 一个请求的旅程

当客户端发起 `POST /users/register`，请求经过：

```
请求进入
    ↓
Controller  — "我是门童，负责迎接请求和送走响应"
  - 解析请求参数（@Body）
  - 调用 Service 处理业务
  - 返回 JSON 响应
    ↓
Service  — "我是业务大脑，负责处理逻辑"
  - 验证数据
  - 执行业务规则
  - 调用 Repository 读写数据
    ↓
Repository / Prisma  — "我是数据搬运工，负责和数据库打交道"
  - CRUD 操作
  - 返回原始数据
    ↓
响应返回（沿原路返回）
```

## 职责边界

### Controller：只做"翻译"

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    // Controller 的职责：
    // 1. 提取和校验请求参数  ← @Body + ValidationPipe 完成了
    // 2. 调用 Service            ← 一行 this.userService.register(dto)
    // 3. 返回响应               ← return + Nest 自动序列化
    return this.userService.register(dto);
  }
}
```

**Controller 不该做的事**：
- ❌ 写业务判断（`if (user.role === 'admin')` → 放 Service）
- ❌ 直接操作数据库（`prisma.user.create()` → 放 Service）
- ❌ 复杂的数据转换（放 Service 或用 DTO）

### Service：所有业务逻辑

```typescript
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterUserDto) {
    // 业务规则 1：查重
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new BadRequestException('用户已存在');
    }

    // 业务规则 2：密码加密
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 数据持久化
    return this.prisma.user.create({
      data: { username: dto.username, password: hashedPassword },
    });
  }
}
```

**Service 不该做的事**：
- ❌ 操作 HTTP 请求/响应对象（`req`, `res` → 那是 Controller 的活）
- ❌ 返回 HTML（那是 View 的活，API 服务不涉及）

### Module：模块的组织者

```typescript
@Module({
  imports: [],           // 需要哪些模块的功能？
  controllers: [],       // 哪些 Controller 处理这个模块的路由？
  providers: [],         // 哪些 Service 提供业务逻辑？
  exports: [],           // 哪些 Provider 可以给其他模块用？
})
```

Module 不做业务，只做**组织**——告诉 Nest "这些文件是一伙的，它们之间可以互相注入"。

## 前端类比

| 后端 | 前端 (Vue) | 前端 (React) | 职责 |
|------|-----------|-------------|------|
| Controller | `<script setup>` 中的路由逻辑 | Page Component | 响应输入、组织输出 |
| Service | Pinia Store / Composable | Custom Hook / Store | 业务逻辑 |
| Module | Vue SFC 的 `<script>` + `<template>` + `<style>` | Feature Folder | 封装一个关注点 |
| DTO | Props 类型定义 | Props Interface | 定义输入结构 |
| Prisma | API 调用层 (axios) | API 调用层 (fetch) | 数据读写 |

## 好的 vs 坏的 Controller

```typescript
// ❌ 坏的：Controller 包含了业务逻辑
@Get(':id')
async findById(@Param('id') id: string) {
  const user = await this.prisma.user.findUnique({ where: { id: +id } });
  if (!user) throw new NotFoundException('用户不存在');
  if (user.role === 'banned') throw new ForbiddenException('用户已封禁');
  const { password, ...safeUser } = user;
  return safeUser;
}

// ✅ 好的：Controller 只做翻译
@Get(':id')
async findById(@Param('id', ParseIntPipe) id: number) {
  return this.userService.findById(id);  // 所有逻辑在 Service
}
```

> 一个小技巧判断代码放哪里：问自己"如果我换成 CLI 命令（不是 HTTP 请求）调用这段逻辑，要不要改？"如果要改，说明逻辑放 Controller 了，应该放到 Service。

---

## 参考链接

- [NestJS — Modules](https://docs.nestjs.com/modules)
- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- [NestJS — Providers](https://docs.nestjs.com/providers)
- 开源笔记：《Nest 通关秘籍》.doc/8. 使用多种 Provider.md
