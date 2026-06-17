# Part XII — 测试体系

> **前置**: [Part XI — 平台集成](../Part-11-平台集成与设备能力/) + 所有 Library App 功能代码

---

## Part XII 章节导航

| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch13](./Chapter-13-Widget测试入门.md) | Widget 测试入门 | 三层测试体系 / pumpWidget / Finder / 交互测试 |
| [Ch19b](./Chapter-19b-模型单元测试入门.md) | 模型单元测试 | Given-When-Then / Fake Repository / 覆盖率 |
| [Ch53](./Chapter-53-单元测试.md) | 单元测试进阶 | ProviderContainer 测试 / Mock 策略 / Jest/Vitest 对照 |
| [Ch54](./Chapter-54-Widget测试.md) | Widget 测试进阶 | 四泵方法 / Finder 大全 / Golden Test / RTL 对照 |
| [Ch55](./Chapter-55-集成测试.md) | 集成测试 | E2E 测试 / patrol 原生交互 / 测试金字塔 |

---

## Part XII 学习目标检查清单

- [ ] 你能为数据模型编写完整的单元测试吗？（Given-When-Then）
- [ ] 你能用 Fake/Mock 隔离外部依赖测试 Repository 和 ViewModel 吗？
- [ ] 你能为关键 Widget 编写交互测试和 Golden Test 吗？
- [ ] 你能编写覆盖完整业务流程的集成测试吗？

### Part XII 独立练习

**为名片 App 编写测试体系**：模型单元测试 → Repository 测试（Fake）→ Widget 交互测试 → 名片交换流程集成测试。

---

> **下一步**: [Part XIII — 性能与质量](../Part-13-性能与质量/)
