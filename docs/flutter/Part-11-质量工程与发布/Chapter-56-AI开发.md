> **Part**: Part XI | **上一章**: [Ch 55](./Chapter-55-CICD.md) | **下一章**: [Ch 57](./Chapter-57-包与插件开发.md)

---

# 第 56 章：Flutter AI 开发 — GenUI、AI Toolkit 与 MCP

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

> **下一步**: [Ch 57](./Chapter-57-包与插件开发.md)
