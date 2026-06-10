# 创建 Nest 项目

## nest new

```bash
nest new book-management-system-backend --package-manager pnpm
```

交互选项：

```
? Would you like to generate a test file? (y/N)
❯ No         ← 我们会在后面学测试时再写

? Would you like to enable strict mode? (Y/n)
❯ Yes        ← 保持 TypeScript 严格模式
```

## 安装校验依赖

```bash
pnpm add class-validator class-transformer
```

## 清理默认文件

删除 `src/app.controller.ts`、`src/app.service.ts` 和对应的测试文件——我们不需要默认的 Hello World。

## 创建 users.json

在项目根目录创建 `users.json`：

```json
[]
```

> `DbService` 启动时会自动处理文件不存在的情况，但这个空数组让初始状态更清晰。

## 项目第一个 commit

```bash
git init
git add .
git commit -m "chore: init book-management-system-backend"
```

## 目录规划

```
src/
├── main.ts              # 入口 + 全局配置
├── app.module.ts        # 根模块
├── db/                  # 数据库模块（JSON 文件版）
│   ├── db.module.ts
│   └── db.service.ts
├── user/                # 用户模块
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── dto/
│   │   ├── register-user.dto.ts
│   │   └── login-user.dto.ts
│   └── entities/
│       └── user.entity.ts
```

> 这个结构和我们 Day 4 学的 Module 组织方式完全一致——一个业务模块一个文件夹，所有相关文件内聚。

---

## 参考链接

- [NestJS — First Steps](https://docs.nestjs.com/first-steps)
- 开源笔记：《Nest 通关秘籍》.doc/28. 图书管理系统：用户模块后端开发.md
