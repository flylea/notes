# Excel 导入导出

## 安装 exceljs

```bash
npm install exceljs
```

## 导出图书列表为 Excel

```typescript
// src/book/book-excel.service.ts
import { Injectable, StreamableFile } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { PassThrough } from 'stream';

@Injectable()
export class BookExcelService {
  constructor(private prisma: PrismaService) {}

  async exportBooks(): Promise<StreamableFile> {
    // 1. 查询所有图书
    const books = await this.prisma.book.findMany({
      include: {
        category: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });

    // 2. 创建工作簿
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('图书列表');

    // 3. 定义列
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: '书名', key: 'title', width: 30 },
      { header: '作者', key: 'author', width: 15 },
      { header: 'ISBN', key: 'isbn', width: 20 },
      { header: '分类', key: 'category', width: 15 },
      { header: '价格', key: 'price', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '创建时间', key: 'createdAt', width: 22 },
    ];

    // 4. 设置表头样式
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // 5. 填充数据
    for (const book of books) {
      sheet.addRow({
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn || '-',
        category: book.category?.name || '-',
        price: book.price ? Number(book.price) : '-',
        status: this.translateStatus(book.status),
        createdAt: book.createdAt.toISOString(),
      });
    }

    // 6. 设置数据样式
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.alignment = { vertical: 'middle' };
      // 隔行变色
      if (i % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
      }
    }

    // 7. 导出为流
    const passThrough = new PassThrough();
    await workbook.xlsx.write(passThrough);

    return new StreamableFile(passThrough);
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      AVAILABLE: '可借',
      BORROWED: '已借出',
      MAINTENANCE: '维护中',
    };
    return map[status] || status;
  }
}
```

## Controller

```typescript
@Controller('book')
export class BookController {
  constructor(private readonly bookExcelService: BookExcelService) {}

  @Get('export-excel')
  @ApiOperation({ summary: '导出图书列表为 Excel' })
  async exportExcel(@Res({ passthrough: true }) res: Response) {
    const date = new Date().toISOString().slice(0, 10);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="books-${date}.xlsx"`,
    });

    return this.bookExcelService.exportBooks();
  }
}
```

## Excel 批量导入

```typescript
// src/book/book-excel.service.ts（续）
import * as multer from 'multer';

async importBooks(fileBuffer: Buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(fileBuffer);

  const sheet = workbook.getWorksheet(1);
  if (!sheet) throw new BadRequestException('Excel 文件为空');

  const results = {
    success: 0,
    failed: 0,
    errors: [] as { row: number; message: string }[],
  };

  // 从第 2 行开始（第 1 行是表头）
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);

    const title = row.getCell(1).text?.trim();
    const author = row.getCell(2).text?.trim();

    if (!title || !author) {
      results.failed++;
      results.errors.push({ row: i, message: '书名和作者不能为空' });
      continue;
    }

    try {
      await this.prisma.book.create({
        data: {
          title,
          author,
          isbn: row.getCell(3).text?.trim() || null,
          price: parseFloat(row.getCell(4).text) || null,
        },
      });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ row: i, message: (error as Error).message });
    }
  }

  return results;
}
```

## 导入 Controller

```typescript
@Post('import-excel')
@UseInterceptors(FileInterceptor('file', {
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('只支持 Excel 文件（.xlsx/.xls）'), false);
    }
  },
}))
async importExcel(@UploadedFile() file: Express.Multer.File) {
  if (!file) throw new BadRequestException('请上传文件');
  return this.bookExcelService.importBooks(file.buffer);
}
```

## Excel 导入的模板格式

```
| 书名         | 作者   | ISBN            | 价格 |
|-------------|--------|-----------------|------|
| NestJS 实战  | 张三   | 978-7-111-10001 | 79   |
| Prisma 指南  | 李四   | 978-7-111-10002 | 89   |
| TypeScript  | 王五   |                 | 69   |

注意：
  - 第一行必须是表头
  - 书名和作者为必填
  - ISBN 和价格为选填
  - 一次导入最多 1000 条
```

---

## 参考链接

- [exceljs — npm](https://www.npmjs.com/package/exceljs)
- [NestJS — StreamableFile](https://docs.nestjs.com/techniques/streaming-files)
