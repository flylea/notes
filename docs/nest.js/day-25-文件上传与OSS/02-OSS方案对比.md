# OSS 对象存储方案对比

## 为什么需要 OSS

```
本地上传的问题：
  - 文件存在服务器硬盘 → 服务重启/迁移 → 丢失
  - 多实例部署 → A 实例上传的文件 B 实例访问不到
  - 服务器带宽有限 → 大文件下载占满带宽
  - 备份需要手动操作

OSS 方案：
  - 文件单独存储在对象存储服务中
  - 所有实例共享同一存储
  - CDN 加速下载
  - 自动备份和冗余
```

## 主流方案对比

| 方案 | 类型 | S3 协议 | 授权 | 价格 | 性能 | 国产化 |
|------|------|:---:|------|------|------|:---:|
| **阿里云 OSS** | 公有云 | ✅ | 商业 | 按量付费 | 高 | ✅ |
| **腾讯云 COS** | 公有云 | ✅ | 商业 | 按量付费 | 高 | ✅ |
| **AWS S3** | 公有云 | ✅ (事实标准) | 商业 | 按量付费 | 最高 | ❌ |
| **MinIO** | 私有部署 | ✅ | AGPLv3 | 免费 | 中高 | ✅ |
| **RustFS** | 私有部署 | ✅ | Apache 2.0 | 免费 | 高 | ✅ |
| **Ceph** | 私有部署 | ✅ | LGPL | 免费 | 中 | ✅ |

## S3 协议是什么

S3（Simple Storage Service）是 AWS 的对象存储接口标准，已成为业界事实标准：

```
S3 协议核心操作：
  PutObject      — 上传文件
  GetObject      — 下载文件
  DeleteObject   — 删除文件
  ListObjects    — 列举文件
  HeadObject     — 获取文件元信息
  Presigned URL  — 生成预签名 URL（临时访问链接）
```

**任何兼容 S3 协议的存储**，都可以用同一套 SDK 操作。这意味着——你的代码写一次，可以在 AWS S3、阿里云 OSS、MinIO、RustFS 之间无缝切换。

## MinIO vs RustFS

| 维度 | MinIO | RustFS |
|------|-------|--------|
| 开发语言 | Go | Rust |
| 开源协议 | AGPLv3（商用需授权） | Apache 2.0（完全自由） |
| 4KB 小对象吞吐 | 基准 | **2.3 倍** |
| 内存占用 | 较高 | 更低 |
| 社区规模 | 大（40K+ GitHub Stars） | 新兴（快速成长） |
| 控制台 UI | 完善 | 简洁但够用 |
| 文档完善度 | 非常完善 | 持续完善中 |
| Docker 部署 | `docker run minio/minio` | `docker run rustfs/rustfs` |

> 两者都兼容 S3 协议，用 `@aws-sdk/client-s3` 或 `minio` npm 包都可以操作。

## 选择建议

```
开发/测试环境  → MinIO（Docker 一键部署，社区资料多）
对协议有要求    → MinIO（AGPLv3 注意商用限制）
追求性能/Apache → RustFS（无协议顾虑，极致性能）
生产环境        → 阿里云 OSS / AWS S3（免运维，SLA 保障）
国产化强制      → MinIO 或 RustFS 私有部署 + 国产数据库生态
```

---

## 参考链接

- [MinIO — Documentation](https://min.io/docs/minio/linux/index.html)
- [RustFS — GitHub](https://github.com/rustfs/rustfs)
- [AWS S3 API Reference](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)
