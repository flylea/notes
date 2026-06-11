> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 61 — CI/CD](./Chapter-61-CICD.md)
> **下一章**: [Chapter 63 — 包与插件开发](./Chapter-63-包与插件开发.md)

---

# 第 62 章：Flutter AI 开发 — GenUI、AI Toolkit 与 MCP

## 0. 本章目标

Flutter AI 工具链全景（GenUI SDK 生成 UI / AI Toolkit 嵌入 AI Agent / MCP Server 连接 AI 模型）、A2UI 协议（Agent-to-UI——AI 操控 App UI）、Agentic Hot Reload（AI 通过 MCP 自动修改代码并热重载验证）、Gemini AI SDK 集成、AI API Key 安全（Edge Function 代理——绝不暴露在客户端）。

> 🎯 **Library App 产出**：AI 智能图书推荐（Gemini SDK→基于借阅历史）、AI 图书摘要（Edge Function + AI API→自动生成图书简介）。

---

## 1. Flutter AI 工具链（Flutter 3.44 新增）

| 工具 | 作用 | 状态 |
|------|------|------|
| **GenUI SDK** | 用自然语言描述 → 自动生成 Flutter Widget 代码 | Experimental |
| **AI Toolkit** | 在 Flutter App 内嵌入 AI Chat/Agent 交互界面 | Beta |
| **MCP Server** | 让 AI 模型（Claude/GPT/Gemini）通过标准化协议读写 Flutter 项目 | Stable |
| **A2UI 协议** | Agent-to-UI——AI Agent 通过结构化 JSON 操控 App 的 Widget 树 | Draft |

### 1.1 GenUI SDK 实操

GenUI SDK 允许你用自然语言描述 UI，自动生成 Flutter 代码。目前处于实验阶段，需在 `pubspec.yaml` 中启用：

```yaml
# pubspec.yaml
dependencies:
  flutter_gen_ui: ^0.1.0  # Experimental — API 可能变化
```

```dart
// 自然语言 → Flutter Widget
import 'package:flutter_gen_ui/gen_ui.dart';

// 输入: "一个红色背景的登录按钮，圆角 8px，点击后显示 SnackBar"
final loginButton = await GenUI.widgetFrom(
  description: 'A red login button with 8px border radius that shows a SnackBar on tap',
  context: buildContext,
);
// GenUI 自动生成对应的 Material/ElevatedButton 代码
```

> 当前 GenUI 适合快速原型和 UI 灵感探索，生产代码仍需人工审查和优化。

### 1.2 MCP Server — AI 直接操作 Flutter 项目

**MCP（Model Context Protocol）**是 Anthropic 提出的标准化协议，让 AI 模型通过统一的工具接口读写文件、执行命令、调用 API。Flutter 团队提供了 MCP Server 实现，使 Claude Code / Cursor 等 AI 工具能直接操作 Flutter 项目：

```bash
# 在 Flutter 项目中启动 MCP Server
flutter pub global activate flutter_mcp
flutter mcp serve

# AI 工具配置（如 Claude Code settings.json）
{
  "mcpServers": {
    "flutter": {
      "command": "flutter",
      "args": ["mcp", "serve"]
    }
  }
}
```

**MCP 能做什么**：
- 读写项目文件（创建/修改/删除 Dart 文件）
- 执行 `flutter analyze` / `flutter test` 并解析结果
- 运行 `flutter run` 并捕获 Hot Reload 反馈
- 调用 `flutter pub add` 管理依赖

**Agentic Hot Reload**：AI 修改代码 → MCP 触发 Hot Reload → 截图对比 → 如果效果不对，AI 自动调整。这个闭环让你在 AI 辅助下实现"描述需求 → 自动迭代 → 验证结果"。

### 1.3 A2UI 协议前瞻

A2UI（Agent-to-UI）是更激进的设想——AI Agent 不生成代码，而是直接输出结构化的 Widget 描述 JSON，Flutter 运行时动态渲染：

```json
// AI 返回的不是代码，而是 Widget 描述
{
  "type": "Scaffold",
  "children": [
    { "type": "AppBar", "props": { "title": "AI 推荐" } },
    { "type": "ListView", "children": "..." }
  ]
}
```

这样 AI 不需要理解 Dart 语法，只需输出合法的 Widget 树结构。目前处于 Draft 阶段。

## 2. Gemini AI 图书推荐

```dart
import 'package:google_generative_ai/google_generative_ai.dart';

class AiRecommendationService {
  final GenerativeModel _model;

  AiRecommendationService() : _model = GenerativeModel(model: 'gemini-2.5-flash', apiKey: apiKey);

  Future<List<String>> recommend({required List<String> borrowedTitles, required List<String> favoriteCategories}) async {
    final prompt = '''Based on the user's borrowing history: ${borrowedTitles.join(', ')}, and preferred categories: ${favoriteCategories.join(', ')}, recommend 5 books the user might enjoy. Return ONLY a JSON array of book titles.''';

    final response = await _model.generateContent([Content.text(prompt)]);
    final titles = jsonDecode(response.text!) as List;
    return titles.cast<String>();
  }
}
```

## 3. AI API Key 安全

```
❌ 错误：客户端直接调用 OpenAI / Gemini API → API Key 暴露在 App 二进制中
✅ 正确：客户端 → Supabase Edge Function → AI API（Edge Function 在服务端，Key 安全）
```

```typescript
// supabase/functions/ai-book-summary/index.ts
serve(async (req) => {
  const { title } = await req.json();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: `Write a 3-sentence summary of the book "${title}".` }] }),
  });
  return new Response(JSON.stringify(await response.json()));
});
```

## 4. AI 开发三原则

1. **API Key 永远走 Edge Function 代理**——客户端二进制中的 Key 等于公开
2. **AI 生成的内容需人工确认**——不要自动执行 AI 返回的代码
3. **A2UI 生成的 Widget 需通过 CI 检查**——lint + test 验证质量

---

## 5. 本章练习

**练习 1：集成 Gemini SDK 到 Library App**
- 在 Library App 中添加 AI 书评功能：选择一本书后，调用 Gemini API 生成一段书评摘要
- 使用 Edge Function（Supabase 或 Cloudflare Workers）代理 API 请求，确保 API Key 不暴露在客户端
- 在 UI 中展示生成的 AI 书评，添加加载/错误状态处理
- 验证标准：API Key 仅存在于 Edge Function 环境变量中，客户端二进制中无法提取

**练习 2：实现 AI 搜索增强功能**
- 在 Library App 的搜索页面中，当用户输入搜索词时，调用 AI 接口对用户输入进行语义理解
- 例如用户输入"适合夏天读的轻松小说"，AI 解析为多个标签/关键词后进行搜索
- 通过 Edge Function 代理请求，并在结果中标注"AI 搜索增强"
- 验证标准：自然语言搜索能返回比关键词匹配更相关的结果

**练习 3：搭建 MCP 开发工作流**
- 为你常用的 IDE（VS Code / Cursor）配置 Flutter 相关的 MCP 工具
- 使用 MCP 工具辅助完成以下任务：为 Library App 的一个现有页面添加 AI 生成的功能注释
- 记录使用 MCP 前后的开发效率差异（是否减少查阅文档的时间）
- 验证标准：MCP 工具可正常调用，能辅助完成至少一个开发任务

---

> **下一步**: [Chapter 63 — 包与插件开发](./Chapter-63-包与插件开发.md)
