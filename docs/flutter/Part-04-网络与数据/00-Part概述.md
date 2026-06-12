# Part IV — 网络与数据

> **前置**: [Part III — 导航与路由](../Part-03-导航与路由/) + [Part I — Dart async/await](../Part-01-起航/)
>
> **本 Part 总览**：从 Mock 数据走向真实后端——HTTP 请求、类型安全 API、JSON 序列化、模型测试、文件上传、WebSocket 实时通信。

---

## Part IV 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Ch17](./Chapter-17-Dio-HTTP客户端.md) | Dio HTTP 客户端 | 拦截器链/Token刷新/三环境/取消 | `lib/core/network/dio_client.dart` |
| [Ch18](./Chapter-18-Retrofit类型安全API.md) | Retrofit 类型安全 API | @GET/@POST/build_runner | Retrofit 接口 + 生成代码 |
| [Ch19](./Chapter-19-freezed-JSON序列化.md) | freezed JSON 序列化 | @freezed/fromJson/toJson/copyWith | Book 模型迁移到 freezed |
| [Ch19b](./Chapter-19b-模型单元测试入门.md) | 模型单元测试入门 | test包/模型测试/ApiResult测试 | `test/models/book_test.dart` |
| [Ch20](./Chapter-20-Supabase集成.md) | Supabase 集成 | 建表/RLS/CRUD/Storage | Supabase项目 + 数据库 |
| [Ch21](./Chapter-21-Supabase高级.md) | Supabase 高级 | Realtime/Edge Functions | 实时订阅 + Auth |
| [Ch22](./Chapter-22-文件上传与实时通信.md) | 文件上传与实时通信 | 分片上传/进度/WebSocket/心跳 | `upload_service.dart` |

---

## Part IV 学习目标检查清单

- [ ] 你能用 Dio + 拦截器链发起 HTTP 请求并处理 Token 刷新吗？
- [ ] 你能为数据模型编写 fromJson/toJson/copyWith 的单元测试吗？
- [ ] 你能上传文件并显示上传进度条吗？
- [ ] 你能选择合适的实时通信方案（Supabase Realtime vs WebSocket）吗？

### Part IV 独立练习

**接入 GitHub REST API**：搜索用户 → 展示列表 → 点击查看详情。为模型和 API 调用编写单元测试。

---

> **下一步**: [Part V — 状态管理](../Part-05-状态管理/)
