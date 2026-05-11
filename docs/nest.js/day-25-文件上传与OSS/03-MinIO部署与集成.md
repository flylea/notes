# MinIO 部署与 Nest 集成

## Docker 部署 MinIO

```bash
# 拉取并启动
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=admin123456 \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

访问：
- S3 API: `http://localhost:9000`
- 管理控制台: `http://localhost:9001`（用户名 admin，密码 admin123456）

## 创建 Bucket 和 Access Key

在控制台中：

```
1. Buckets → Create Bucket → 名称: book-covers
2. Access Keys → Create Access Key
   → Access Key: minioadmin123
   → Secret Key: minioadmin123456789
```

## Nest 集成——安装 SDK

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## MinIO Service 封装

```typescript
// src/oss/minio.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioService implements OnModuleInit {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('OSS_BUCKET', 'book-covers');
  }

  onModuleInit() {
    this.s3Client = new S3Client({
      region: 'us-east-1',  // MinIO 默认 region
      endpoint: this.configService.get('OSS_ENDPOINT', 'http://localhost:9000'),
      credentials: {
        accessKeyId: this.configService.getOrThrow('OSS_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow('OSS_SECRET_KEY'),
      },
      forcePathStyle: true,  // MinIO 要求 path-style 地址
    });
  }

  // 上传文件
  async uploadFile(key: string, body: Buffer, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    return {
      key,
      url: `${this.configService.get('OSS_PUBLIC_URL')}/${this.bucket}/${key}`,
    };
  }

  // 删除文件
  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  // 生成预签名上传 URL（安全前端直传）
  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      uploadUrl: url,
      key,
      expiresIn,
    };
  }

  // 生成预签名下载 URL
  async getPresignedDownloadUrl(key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
```

## 在 Controller 中使用

```typescript
// src/book/book.controller.ts
@Post('upload-cover')
@UseInterceptors(FileInterceptor('cover'))
async uploadCover(
  @UploadedFile() file: Express.Multer.File,
  @Body('id') id: string,
) {
  // 生成唯一 key
  const ext = file.originalname.split('.').pop();
  const key = `books/${id}/cover-${Date.now()}.${ext}`;

  // 上传到 MinIO
  const result = await this.minioService.uploadFile(
    key,
    file.buffer,
    file.mimetype,
  );

  // 更新数据库中的封面 URL
  await this.bookService.update(parseInt(id, 10), { cover: result.url });

  return result;
}
```

## 配置 .env

```bash
# MinIO 配置
OSS_ENDPOINT=http://localhost:9000
OSS_ACCESS_KEY=minioadmin123
OSS_SECRET_KEY=minioadmin123456789
OSS_BUCKET=book-covers
OSS_PUBLIC_URL=http://localhost:9000
```

---

## 参考链接

- [MinIO — Docker Quickstart](https://min.io/docs/minio/container/index.html)
- [AWS SDK for JavaScript — S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
