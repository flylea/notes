# Day 20：JWT 认证

## 今日概览

Day 19 完成了图书管理系统的数据库迁移。但系统目前没有认证机制——任何人都能调用借书/还书接口。今天为系统加上 JWT 登录认证，让接口知道"你是谁"。

## 学习目标

- 理解 Session、JWT、OAuth 等认证方案的原理和选型
- 掌握 JWT 的生成、解析和验证
- 在 Nest 中集成 @nestjs/jwt
- 实现 AuthGuard 拦截未登录请求
- 实现 Token 自动续期

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-四种认证方案对比.md](01-四种认证方案对比.md) | 四种认证方案对比：Session/JWT/OAuth/Passport |
| [02-JWT结构详解.md](02-JWT结构详解.md) | JWT 结构详解：Header/Payload/Signature |
| [03-JwtModule集成与配置.md](03-JwtModule集成与配置.md) | @nestjs/jwt 集成与配置 |
| [04-登录签发Token.md](04-登录签发Token.md) | 登录接口签发 Token |
| [05-AuthGuard认证守卫.md](05-AuthGuard认证守卫.md) | AuthGuard：解析 Token、挂载用户信息 |
| [06-Token续期方案.md](06-Token续期方案.md) | Token 续期方案：双 Token vs 单 Token |
| [07-IsPublic公开接口标记.md](07-IsPublic公开接口标记.md) | @IsPublic() 标记公开接口 |
