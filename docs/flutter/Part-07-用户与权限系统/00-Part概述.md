# Part VII — 用户与权限系统

> **前置**: [Part-VI — 应用架构](../Part-06-应用架构/) + [Part-IV — Supabase](../Part-04-网络与数据/)

---

## Part VII 章节导航

| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch34](./Chapter-34-Supabase-Auth认证体系.md) | Supabase Auth 认证体系 | 注册/登录/AuthGuard/Session/OAuth/Magic Link |
| [Ch35](./Chapter-35-安全存储与生物识别.md) | 安全存储与生物识别 | flutter_secure_storage/local_auth/隐私锁屏 |
| [Ch36](./Chapter-36-RBAC权限管理.md) | RBAC 权限管理 | 三级角色/app_metadata Claims/RLS按角色/缓存策略 |

---

## Part VII 学习目标检查清单

- [ ] 你能实现完整的注册/登录/OAuth 流程吗？
- [ ] 你能配置基于角色的 RLS 策略吗？
- [ ] 你能保护敏感数据（Token/密钥）并集成生物识别吗？

### Part VII 独立练习

**实现名片 App 的登录/注册/权限**：接入 Supabase Auth、区分用户角色、保护敏感数据。

---

> **下一步**: [Part VIII — 本地持久化与离线](../Part-08-本地持久化与离线/)
