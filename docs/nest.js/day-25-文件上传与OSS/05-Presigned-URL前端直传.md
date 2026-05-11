# Presigned URL 前端直传

## 传统上传 vs Presigned URL 上传

```
传统上传：
  浏览器 → Nest 服务器 → OSS
  文件流经服务器，占用带宽和内存

Presigned URL 上传：
  1. 浏览器请求 Nest → 得到临时上传 URL
  2. 浏览器直接 PUT 到 OSS（不经过 Nest）
  3. 浏览器通知 Nest → Nest 更新数据库

  文件不经过 Nest 服务器——省带宽、省内存 ✅
```

## 安全性分析

```
Presigned URL 的安全机制：

1. 临时凭证：URL 中包含签名，有效期过后自动失效
   例：PUT http://oss/book-covers/cover.jpg?X-Amz-Signature=xxx&X-Amz-Expires=3600
   3600 秒后这个 URL 就作废了

2. 服务端控制：前端不持有 accessKey/secretKey
   前端只知道 uploadUrl，无法用这个 URL 做其他操作

3. 条件限制：Presigned URL 可以限定
   - 最大文件大小（Content-Length 头）
   - 文件类型（Content-Type 头）
```

## 后端：生成 Presigned URL

```typescript
// src/oss/oss.service.ts
@Injectable()
export class OssService {
  async createUploadSession(
    fileName: string,
    fileSize: number,
    contentType: string,
  ) {
    // 1. 安全校验
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException('不支持的文件类型');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    // 2. 生成唯一 key
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const ext = fileName.split('.').pop();
    const key = `covers/${datePrefix}/${crypto.randomUUID()}.${ext}`;

    // 3. 生成 Presigned URL
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 600,  // 10 分钟有效期
    });

    return {
      uploadUrl,       // 前端用这个 URL 上传
      key,             // 上传完成后用 key 通知后端
      expiresIn: 600,
    };
  }

  // 上传完成后的回调
  async confirmUpload(key: string, bookId: number) {
    // 1. 检查文件是否真的上传了
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      throw new BadRequestException('文件未找到');
    }

    // 2. 生成公开访问 URL
    const publicUrl = `${process.env.OSS_PUBLIC_URL}/${this.bucket}/${key}`;

    // 3. 更新数据库
    // await this.prisma.book.update({
    //   where: { id: bookId },
    //   data: { cover: publicUrl },
    // });

    return { url: publicUrl, key };
  }
}
```

## Controller

```typescript
// src/upload/oss-upload.controller.ts
@Controller('upload')
export class OssUploadController {
  constructor(private readonly ossService: OssService) {}

  @Post('prepare')
  async prepare(@Body() body: { fileName: string; fileSize: number; contentType: string }) {
    return this.ossService.createUploadSession(
      body.fileName,
      body.fileSize,
      body.contentType,
    );
  }

  @Post('confirm')
  async confirm(
    @Body('key') key: string,
    @Body('bookId') bookId: string,
  ) {
    return this.ossService.confirmUpload(key, parseInt(bookId, 10));
  }
}
```

## 前端上传代码

```typescript
async function presignedUrlUpload(file: File, bookId: number) {
  // 1. 请求 Presigned URL
  const { uploadUrl, key } = await fetch('/upload/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }),
  }).then(r => r.json());

  // 2. 直传 OSS
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  // 3. 通知后端上传完成
  const { url } = await fetch('/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, bookId }),
  }).then(r => r.json());

  return url;
}
```

## 架构图

```
┌──────────┐     1. POST /upload/prepare     ┌───────────┐
│  浏览器   │ ─────────────────────────────→  │ Nest 服务  │
│          │ ←─────────────────────────────  │           │
│          │     { uploadUrl, key }           └───────────┘
│          │
│          │     2. PUT uploadUrl (直传 OSS)
│          │ ─────────────────────────────→  ┌───────────┐
│          │ ←─────────────────────────────  │ MinIO /   │
│          │     200 OK                      │ RustFS    │
│          │                                  └───────────┘
│          │     3. POST /upload/confirm
│          │ ─────────────────────────────→  ┌───────────┐
│          │ ←─────────────────────────────  │ Nest 服务  │
│          │     { url }                      └───────────┘
└──────────┘
```

> 文件完全绕过业务服务器，只在准备阶段和确认阶段与 Nest 交互。

---

## 参考链接

- [AWS S3 — Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/presigned-urls.html)
- [@aws-sdk/s3-request-presigner](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/)
