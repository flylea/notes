# multer 文件上传配置

## 安装

```bash
npm install @types/multer
```

> ⚠️ `npm install multer` 不需要——Nest 已经内置了 multer 的适配层 `@nestjs/platform-express`，multer 是其传递依赖。

## 基础配置

```typescript
// src/book/book.controller.ts
import {
  Post,
  UseInterceptors,
  UploadedFile,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('book')
export class BookController {
  @Post('upload-cover')
  @UseInterceptors(
    FileInterceptor('file', {  // 'file' = 表单字段名
      storage: diskStorage({
        destination: './uploads/covers',  // 存储目录
        filename: (req, file, callback) => {
          // 生成唯一文件名：时间戳 + 随机字符串 + 原扩展名
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,  // 5MB 限制
      },
      fileFilter: (req, file, callback) => {
        // 只允许图片格式
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('只允许上传图片文件'), false);
        }
        callback(null, true);
      },
    }),
  )
  uploadCover(
    @UploadedFile() file: Express.Multer.File,
    @Query('id') id: string,
  ) {
    // file 包含了上传文件的所有信息
    const coverUrl = `/uploads/covers/${file.filename}`;
    return this.bookService.updateCover(id, coverUrl);
  }
}
```

## multer 核心概念

### Storage — 文件存在哪里

| 方式 | 说明 | 适用场景 |
|------|------|---------|
| `diskStorage` | 保存到硬盘 | 本地开发、小文件 |
| `memoryStorage` | 保存在内存 Buffer | 直传 OSS/MinIO（Day 25） |
| 自定义 Storage | 自定义存储逻辑 | 特殊需求 |

### diskStorage 详解

```typescript
diskStorage({
  destination: (req, file, cb) => {
    // 可以根据请求信息动态指定目录
    const type = req.body.type || 'misc';
    cb(null, `./uploads/${type}`);
  },
  filename: (req, file, cb) => {
    // 自定义文件名规则
    const uniqueName = `${Date.now()}-${randomUUID()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
})
```

### Limits — 限制上传

```typescript
limits: {
  fileSize: 5 * 1024 * 1024,  // 单个文件最大 5MB
  files: 1,                    // 最多允许 1 个文件
  fields: 10,                  // 最多允许 10 个非文件字段
}
```

### fileFilter — 类型过滤

```typescript
fileFilter: (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);   // 接受文件
  } else {
    cb(new BadRequestException('只允许上传 JPEG/PNG/GIF/WEBP 图片'), false);
  }
}
```

## Nest 内置的 File 校验 Pipe

Nest 提供了 `ParseFilePipe` 替代在 `fileFilter` 中手写校验：

```typescript
@Post('upload-cover')
@UseInterceptors(FileInterceptor('file'))
uploadCover(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),      // 5MB
        new FileTypeValidator({ fileType: /\.(jpg|jpeg|png|gif)$/ }), // 图片格式
      ],
      fileIsRequired: true,   // 必传文件
      exceptionFactory: (error) => {
        throw new BadRequestException(error);
      },
    }),
  )
  file: Express.Multer.File,
) {
  // 校验通过才到这里
}
```

## 多文件上传

```typescript
import { FilesInterceptor } from '@nestjs/platform-express';

@Post('upload-multiple')
@UseInterceptors(FilesInterceptor('files', 5))  // 最多 5 个文件
uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
  return files.map(f => ({ filename: f.filename, url: `/uploads/${f.filename}` }));
}
```

> ⚠️ 前端上传文件时，`Content-Type` 必须是 `multipart/form-data`，不能用 `application/json`。

---

## 参考链接

- [NestJS — File Upload](https://docs.nestjs.com/techniques/file-upload)
- [multer — Documentation](https://github.com/expressjs/multer#readme)
- 开源笔记：《Nest 通关秘籍》.doc/29.图书管理系统：文件和图书模块后端开发.md
