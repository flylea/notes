# Day 22：配置管理

## 今日概览

项目中的数据库连接、JWT 密钥、Redis 地址等配置散落在各文件中。今天使用 @nestjs/config 统一管理所有配置，支持多环境切换和启动时校验。

## 学习目标

- 对比 dotenv 基础方案 vs ConfigModule
- 掌握 ConfigService 的注入和使用
- 实现多环境配置切换
- 使用 Joi 验证配置完整性
- 了解 YAML 配置方案

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-dotenv与ConfigModule对比.md](01-dotenv与ConfigModule对比.md) | dotenv vs @nestjs/config 对比 |
| [02-ConfigService使用详解.md](02-ConfigService使用详解.md) | ConfigService 使用详解 |
| [03-多环境配置切换.md](03-多环境配置切换.md) | 多环境配置切换 |
| [04-Joi验证配置完整性.md](04-Joi验证配置完整性.md) | Joi 验证配置完整性 |
| [05-YAML配置方案.md](05-YAML配置方案.md) | YAML 配置文件方案 |
| [06-自定义配置文件与namespace.md](06-自定义配置文件与namespace.md) | 自定义配置文件与 namespace |
