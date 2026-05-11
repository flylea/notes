# RustFS 介绍与部署

## RustFS 是什么

RustFS 是用 Rust 编写的 S3 兼容对象存储服务。对标 MinIO，但在小文件吞吐和内存效率上有显著优势。Apache 2.0 协议，商用友好。

```
核心优势：
  - Rust 语言编写：内存安全 + 无 GC 停顿
  - 4KB 小对象吞吐：MinIO 的 2.3 倍
  - Apache 2.0：商用无限制（MinIO 的 AGPLv3 商业使用需要授权）
  - API 完全兼容 S3：代码零改动切换
```

## Docker 部署

```bash
# 拉取并启动
docker run -d \
  --name rustfs \
  -p 9000:9000 \
  -p 9001:9001 \
  -e RUSTFS_ROOT_USER=admin \
  -e RUSTFS_ROOT_PASSWORD=admin123456 \
  -v rustfs_data:/data \
  rustfs/rustfs server /data --console-address ":9001"
```

## 与 MinIO 相同的代码

因为 RustFS 兼容 S3 协议，之前在 MinIO 写的代码**完全不用改**：

```typescript
// 这段代码对 MinIO 和 RustFS 都有效
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.OSS_ENDPOINT, // http://localhost:9000
  credentials: {
    accessKeyId: process.env.OSS_ACCESS_KEY,
    secretAccessKey: process.env.OSS_SECRET_KEY,
  },
  forcePathStyle: true,
});

// PutObject / GetObject / DeleteObject 都一样
await s3Client.send(new PutObjectCommand({ ... }));
await s3Client.send(new GetObjectCommand({ ... }));
await s3Client.send(new DeleteObjectCommand({ ... }));
```

## 切换方法

```bash
# 从 MinIO 切换到 RustFS
# docker stop minio && docker rm minio
# docker run ... rustfs/rustfs

# .env 无需改动（端点、密钥都一样）
OSS_ENDPOINT=http://localhost:9000
OSS_ACCESS_KEY=admin
OSS_SECRET_KEY=admin123456
OSS_BUCKET=book-covers

# 代码零改动 ✅
```

## MinIO → RustFS 迁移

```bash
# 如果 MinIO 中有数据，使用 S3 兼容工具迁移
# 安装 mc (MinIO Client)
mc alias set source http://localhost:9000 admin admin123456
mc alias set target http://localhost:9001 admin admin123456
mc mirror source/book-covers target/book-covers
```

## 控制台

```
RustFS 控制台: http://localhost:9001
登录: admin / admin123456

功能：
  - 创建/删除 Bucket
  - 浏览文件
  - 上传/下载
  - 生成 Access Key
  - 监控存储使用量
```

## 选型最终建议

```
选择 MinIO 如果：
  - 团队熟悉 Go 生态
  - 需要丰富的社区插件和工具链
  - 可以接受 AGPLv3（或购买商业授权）
  - 社区支持非常重要

选择 RustFS 如果：
  - 需要 Apache 2.0 自由协议
  - 小文件场景较多（封面、缩略图）
  - 追求低内存占用和高吞吐
  - 喜欢 Rust 生态
```

> 两种方案的 Nest 集成代码完全一样，选哪个对开发没有影响。建议先在 MinIO 上开发（资料更多），生产环境根据需求选择。

---

## 参考链接

- [RustFS — GitHub](https://github.com/rustfs/rustfs)
- [S3 API Compatibility](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)
