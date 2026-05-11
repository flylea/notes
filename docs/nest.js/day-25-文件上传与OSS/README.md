# Day 25：文件上传高级篇

## 今日概览

Day 12 实现了本地上传和静态文件托管。今天升级到生产级方案：大文件分片上传、OSS 对象存储（MinIO/RustFS/S3）、Presigned URL 直传、Excel 导入导出。

## 学习目标

- 理解大文件分片上传和断点续传原理
- 对比主流 OSS 方案并作出选型
- 掌握 MinIO/RustFS 的 Docker 部署和 Nest 集成
- 实现 Presigned URL 前端直传（安全方案）
- 掌握 Excel 导入导出的流式处理

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-大文件分片上传.md](01-大文件分片上传.md) | 大文件分片上传与断点续传 |
| [02-OSS方案对比.md](02-OSS方案对比.md) | OSS 对象存储方案对比 |
| [03-MinIO部署与集成.md](03-MinIO部署与集成.md) | MinIO 部署与集成 |
| [04-RustFS部署与集成.md](04-RustFS部署与集成.md) | RustFS 介绍与部署 |
| [05-Presigned-URL前端直传.md](05-Presigned-URL前端直传.md) | Presigned URL 前端直传 |
| [06-StreamableFile流式下载.md](06-StreamableFile流式下载.md) | StreamableFile 流式下载 |
| [07-Excel导入导出.md](07-Excel导入导出.md) | Excel 导入导出 |
