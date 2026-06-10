# StreamableFile 流式下载

## 问题：传统文件下载

```typescript
// ❌ 传统方式——大文件撑爆内存
@Get('download')
async download() {
  const fileBuffer = await fs.promises.readFile('./big-file.zip');
  // 2GB 文件 → 2GB 内存占用！
  return fileBuffer;
}
```

## 解决方案：StreamableFile

```typescript
// ✅ 流式下载——内存占用恒定
import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { join } from 'path';

@Get('download/:filename')
async download(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
  const filePath = join(process.cwd(), 'uploads/books', filename);

  // 安全检查：防止路径遍历攻击
  if (!filePath.startsWith(join(process.cwd(), 'uploads'))) {
    throw new BadRequestException('非法文件路径');
  }

  // 检查文件是否存在
  try {
    await fs.promises.access(filePath);
  } catch {
    throw new NotFoundException('文件不存在');
  }

  const fileStream = createReadStream(filePath);
  const stat = await fs.promises.stat(filePath);

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length': stat.size.toString(),
  });

  return new StreamableFile(fileStream);
}
```

## 从 OSS 流式下载

```typescript
// src/oss/oss.service.ts
async downloadStream(key: string): Promise<{ stream: Readable; contentType: string; size: number }> {
  // 获取对象元信息
  const headCommand = new HeadObjectCommand({
    Bucket: this.bucket,
    Key: key,
  });

  const headResult = await this.s3Client.send(headCommand);

  // 获取对象内容
  const getCommand = new GetObjectCommand({
    Bucket: this.bucket,
    Key: key,
  });

  const result = await this.s3Client.send(getCommand);

  return {
    stream: result.Body as Readable,
    contentType: result.ContentType || 'application/octet-stream',
    size: result.ContentLength || 0,
  };
}

// Controller
@Get('download')
async download(@Query('key') key: string, @Res({ passthrough: true }) res: Response) {
  const { stream, contentType, size } = await this.ossService.downloadStream(key);

  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(key.split('/').pop()!)}"`,
    'Content-Length': size.toString(),
  });

  return new StreamableFile(stream);
}
```

## PassThrough 中间转换

有时需要在流传输过程中做些处理：

```typescript
import { StreamableFile } from '@nestjs/common';
import { PassThrough } from 'stream';

@Get('download-compressed')
async downloadCompressed(@Res({ passthrough: true }) res: Response) {
  const fileStream = createReadStream('./data.json');
  const passThrough = new PassThrough();

  // 可以做：压缩、加密、格式转换...
  fileStream.pipe(passThrough);

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': 'attachment; filename="data.json"',
  });

  return new StreamableFile(passThrough);
}
```

## 范围下载（Range Request）

支持视频跳转播放、大文件断点续传：

```typescript
@Get('video/:filename')
async streamVideo(
  @Param('filename') filename: string,
  @Req() req: Request,
  @Res() res: Response,
) {
  const filePath = join(process.cwd(), 'uploads/videos', filename);
  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    stream.pipe(res);
  } else {
    // 没有 Range 头 → 完整下载
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    });

    createReadStream(filePath).pipe(res);
  }
}
```

> 视频网站、大文件下载都需要 Range 支持。浏览器、播放器会自动发起 Range 请求。

---

## 参考链接

- [NestJS — StreamableFile](https://docs.nestjs.com/techniques/streaming-files)
- [Node.js — Stream API](https://nodejs.org/api/stream.html)
- [MDN — Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
