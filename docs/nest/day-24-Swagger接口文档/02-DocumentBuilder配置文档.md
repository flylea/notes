# Swagger 安装与配置

## 安装

```bash
npm install @nestjs/swagger
```

## main.ts 配置

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ==================== Swagger 配置 ====================
  const config = new DocumentBuilder()
    .setTitle('图书管理系统 API')
    .setDescription('图书管理系统的完整接口文档，包含用户、图书、借阅等功能')
    .setVersion('2.0.0')
    .setContact('开发团队', 'https://example.com', 'dev@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', '本地开发环境')
    .addServer('https://api.example.com', '生产环境')
    // JWT 认证
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: '输入 JWT Token',
        in: 'header',
      },
      'bearer',  // 认证方案名称——装饰器中引用
    )
    .addTag('图书管理', '图书的增删改查')
    .addTag('用户认证', '注册、登录、Token 刷新')
    .addTag('借阅管理', '借书、还书、借阅记录')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,  // 刷新页面后保持 Token
      docExpansion: 'list',        // 默认折叠接口列表
      filter: true,                // 搜索过滤
      showRequestDuration: true,   // 显示请求耗时
    },
    customSiteTitle: '图书管理系统 API 文档',
    customCss: '.swagger-ui .topbar { display: none }',  // 隐藏顶部 Swagger logo
  });

  await app.listen(3000);
}
bootstrap();
```

## 访问

```
启动服务后打开：http://localhost:3000/api-docs
```

## DocumentBuilder 全部方法

```typescript
const config = new DocumentBuilder()
  .setTitle('API 标题')                    // 文档标题
  .setDescription('API 描述')              // 文档描述（支持 Markdown）
  .setVersion('1.0.0')                     // 版本号
  .setTermsOfService('https://...')        // 服务条款 URL
  .setContact('作者', 'URL', '邮箱')        // 联系方式
  .setLicense('MIT', 'https://...')        // 许可证
  .addServer('http://localhost:3000')      // 服务器地址（可多次调用添加多个）
  .setBasePath('/api')                     // 基础路径（已弃用，用 addServer）

  // 认证方式
  .addBearerAuth()                         // Bearer Token (JWT)
  .addBasicAuth()                          // HTTP Basic Auth
  .addApiKey({ type: 'apiKey' }, 'api-key')// API Key
  .addCookieAuth('auth-cookie')            // Cookie 认证
  .addOAuth2()                             // OAuth 2.0

  // 标签分组
  .addTag('分组名', '分组描述')             // 为接口分组

  .build();
```

## SwaggerModule.setup 选项

```typescript
SwaggerModule.setup('api-docs', app, document, {
  // Swagger UI 配置
  swaggerOptions: {
    persistAuthorization: true,   // 刷新页面保持认证状态
    docExpansion: 'list',         // 'list' | 'full' | 'none'
    filter: true,                 // 搜索框
    showRequestDuration: true,    // 显示请求耗时
    defaultModelsExpandDepth: 1,  // DTO Schema 展开深度
    displayRequestDuration: true,
    tryItOutEnabled: true,        // 允许 Try it out
  },

  // 自定义
  customSiteTitle: '自定义页面标题',
  customfavIcon: '/favicon.ico',
  customCss: '.swagger-ui .topbar { display: none }',
  customJs: '/swagger-custom.js',

  // JSON 文档端点
  jsonDocumentUrl: '/api-docs/json',  // 同时提供 JSON 格式
});
```

## 安全配置——生产环境隐藏文档

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 只在非生产环境启用 Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('图书管理系统 API')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(3000);
}
```

> 生产环境暴露 API 文档可能带来安全风险（攻击者可以了解你的接口结构）。建议只在开发/测试环境启用，或对文档地址加 IP 白名单 + HTTP Basic Auth。

---

## 参考链接

- [NestJS — OpenAPI Setup](https://docs.nestjs.com/openapi/introduction#bootstrap)
- [Swagger UI — Configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
