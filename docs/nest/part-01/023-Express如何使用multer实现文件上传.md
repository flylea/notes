# 第 23 章 Express 如何使用 multer 实现文件上传

用户在页面上点一下“上传海报”，从电脑里挑一张图，等两秒，页面提示成功。这两秒里浏览器干的事，和平时调一个 JSON 接口完全不是一回事。

JSON 像一张写满字的纸：折起来塞进信封，收件人拆开就能读。图片像一箱实物：信封塞不下，硬塞就得先把它拆成一串字符（Base64），体积涨三分之一，收件人收到还得先拼回去。所以浏览器不会把文件塞进 JSON，它换了一种打包方式，叫 `multipart/form-data`。

名字先放一边，看它解决什么问题：一次请求里既要带普通字段（标题、分类），又要带文件，还得让服务端分得清哪段是哪个。它的做法像搬家分箱——书装一箱、锅碗装一箱，每箱外面贴一张纸条，写明这箱是什么；箱子与箱子之间用一条印着随机编号的胶带隔开。这条胶带叫 **boundary**（边界），编号同时写在请求头的 `Content-Type` 里，服务端照着编号找切口。没有它，服务端收到的是一整块字节：不知道文件从哪个字节开始，也不知道标题在哪儿结束。

它和 JSON 的差别就在这儿：JSON 靠花括号和引号分层，只能装文本；multipart 靠 boundary 分段，给二进制留了位置，文件字节原样放进去，不做编码，体积不涨。[FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) 是浏览器里负责打包的东西，[multipart/form-data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types#multipartform-data) 是包裹格式本身的说明。

第 4 章已经用过一次 form-data，那时只关心“文件放在 body 里”，用 `@UploadedFiles()` 把文件信息取出来。这一章往下走一层：这段 body 到底由谁拆开，拆完的文件又放到哪儿。

## Express 的分拣员不认识 multipart

请求进了 Express，第一道关是 body parser（请求体解析器）。你可以把它想成快递站的分拣员：只看包裹面单上的“品类”——也就是请求头的 `Content-Type`——决定送到哪个窗口。`express.json()` 只接 `application/json`，`express.urlencoded()` 只接表单，`express.raw()` 接原始字节，`express.text()` 接纯文本。multipart 这个品类不在任何窗口的名单里，包裹就原样搁在那儿，没人拆。

所以文件上传失败时，`req.body` 是个空对象，`req.file` 压根不存在。这不是文件太大，也不是字段名写错，是**没有解析器接手这个请求**。

先看一个真实事故。

页面加了一个“上传海报”的按钮。用户选一张图，前端用 `FormData` 打包，POST 到 `/api/uploads`。接口返回了 201，可你打开日志一看：`req.body` 是 `{}`，`req.file` 是 `undefined`，磁盘上也没有任何新文件。

请求确实到了，路由也确实进了，文件却凭空消失。原因就是上面那句：没人接手的请求，body 不会被拆开。下面把 multipart 的报文拆开，看看浏览器到底写了什么。

## multipart 的包裹长什么样

页面上只要有 `<input type="file">`，表单提交时就会编码成 `multipart/form-data`。它把请求体切成若干段，每一段叫一个 **part**，段与段之间用那串随机字符（boundary）隔开。

```text
POST /api/uploads HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXk3

------WebKitFormBoundaryXk3
Content-Disposition: form-data; name="title"

活动海报
------WebKitFormBoundaryXk3
Content-Disposition: form-data; name="file"; filename="poster.png"
Content-Type: image/png

<PNG 的二进制字节>
------WebKitFormBoundaryXk3--
```

每个 part 的骨架都一样：几行头、一个空行、然后是这一段的内容。普通字段的内容是文本，文件字段的内容是原始字节。最后一行 `--boundary--` 表示包裹到此结束。

这就能解释 `req.body` 为什么是空的了：请求体根本不是 `{"title":"..."}` 这种结构，`JSON.parse` 无从下手。拿它当 JSON 读，就像拿菜谱去对一张装箱单，格式对不上。

顺带纠正一个很常见的误解：`express.json({ limit: '1mb' })` 里的 `limit` 对上传请求完全无效，因为这个中间件压根没处理它。上传的体积上限必须由专门拆 multipart 的中间件，或者更外层的网关来管。

有人会想：那把文件转成 Base64 塞进 JSON 不就行了？几十 KB 的小图确实能跑，但体积会涨三分之一，服务端还得先整体读进内存再解码落盘，中间任何一个字符坏掉都会让整段数据没法定位。文件一旦到 MB 级，这条路就是给自己找麻烦。

还有人用 `busboy` 自己写事件处理，或者用 `formidable`。都能干活，只是要多写一层胶水。Express 生态里最省事、Nest 也拿它当底座的，是 multer——[multer 的 README](https://github.com/expressjs/multer) 把配置项列得很全，这一章就按它的四件事展开。

## multer 一次读完做四件事

multer 是一个中间件，底层用 busboy 边读边解析。你把它想成专门拆这种分箱包裹的师傅：一边拆，一边把东西放到该去的地方。它在一次请求里依次做四件事：

1. 按 `limits` 限制文件大小、文件数、字段数、part 数；
2. 对每个文件调用 `fileFilter`，决定收不收；
3. 把文件流交给 **storage engine**（存储引擎，决定字节写内存还是写磁盘）；
4. 把普通字段挂到 `req.body`，把文件挂到 `req.file`（多文件是 `req.files`）。

存储引擎可以理解成仓库管理员：内存模式是先把货摊在前台桌上，磁盘模式是直接推进货架。`fileFilter` 则是门口保安，只看你填的申报单，不开箱。

顺序很重要，它直接决定了能力边界：`fileFilter` 执行的时候，文件还没落盘，它拿到的 `mimetype`、`originalname` 全是客户端自己声明的，只能做便宜的初筛；反过来，如果你等落盘后再判断类型，攻击者的 `shell.php` 已经在磁盘上存在过一瞬间了。

先装依赖，跑一个最小版本看看效果。

```bash
mkdir express-multer-upload && cd express-multer-upload
pnpm init
pnpm add express@5.3.0 multer@2.5.0
pnpm add -D typescript@5.9.3 @types/node@22.15.3 @types/express@5.0.6 @types/multer@2.3.0
```

`package.json` 里设置 `"type": "module"`，这样相对导入必须带 `.js` 后缀——这是 ESM 在 Node 里的真实解析规则，不是风格偏好。最小服务只需要一个路由：

```ts
// src/server.ts
import express, { type Request, type Response } from 'express';
import multer from 'multer';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/api/uploads', upload.single('file'), (req: Request, res: Response) => {
  console.log('body:', req.body);
  console.log('file:', req.file);
  res.status(201).json({ data: req.file ?? null });
});

app.listen(3000, () => console.log('listening on http://localhost:3000'));
```

`upload.single('file')` 里的 `'file'` 是表单字段名，必须和前端 `FormData` 里 `append` 的 key 完全一致；写错一个字母，结果永远是 `req.file === undefined`。`dest: 'uploads/'` 是最省事的配置，multer 会自己建目录、自己起一个随机文件名——相当于寄存柜给你一张随机小票，东西在，但名字不由你定。

跑起来，用一张真实的 PNG 试：

```bash
# 生成一张 1×1 的 PNG 当测试文件
mkdir -p fixtures
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > fixtures/pixel.png

node --watch src/server.ts
# listening on http://localhost:3000

curl -s -F "file=@fixtures/pixel.png;type=image/png" http://localhost:3000/api/uploads
# {"data":{"fieldname":"file","originalname":"pixel.png","encoding":"7bit","mimetype":"image/png","path":"uploads/2f1c...","size":70,...}}
```

服务端控制台会打出 `body: [Object: null prototype] {}` 和完整的 `req.file` 对象，`uploads/` 目录里多了一个没有扩展名的文件。到这一步，上传就算通了。

但 `req.file` 里这几个字段，恰好暴露了三个问题：

- `originalname` 是客户端给的。它可以叫 `../../etc/passwd`，也可以带控制字符。
- `mimetype` 是客户端声明的，写什么就是什么。
- `size` 是读完之后才知道的，而 `dest` 模式没有大小上限。

下面三节分别处理这三件事。

## 文件名和目录，必须由服务端说了算

默认的 `dest` 会把文件存成随机字符串，没有扩展名。静态服务靠扩展名猜 `Content-Type`，浏览器下载时就会把图片当成 `application/octet-stream`，要么预览不了，要么被安全策略拦下。所以生产代码几乎都会换成 `diskStorage`，自己决定目录和文件名。

`diskStorage` 就是 multer 的存储引擎接口：`destination` 决定写哪个目录，`filename` 决定叫什么名字。两个回调都是异步的，第三个参数是 Node 风格的 `callback(error, value)`——干完活回个电话，告诉它成功还是失败、结果是什么。

```ts
// src/upload.ts
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import multer from 'multer';

export const UPLOAD_DIR = join(process.cwd(), 'storage', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXT = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    const ext = MIME_EXT.get(file.mimetype) ?? '.bin';
    callback(null, `${randomUUID()}${ext}`);
  },
});
```

这里有三个决定值得说清楚。

第一，**落盘名绝不使用 `originalname`**。客户端可以传 `../../../etc/cron.d/evil`，也可以传一个两百字符的扩展名。统一用 UUID，原文件名只作为展示用的元数据存进数据库，永远不参与路径拼接。

第二，**扩展名从声明的 MIME 推导**，而不是从原文件名截取。这样“声明 `image/png`、文件名却是 `x.php`”的请求不会写出一个 `.php` 文件。

第三，`mkdirSync` 放在模块顶层执行一次。模块只加载一次，目录只建一次，比每次请求都 `mkdir` 省事。容器里如果目录是挂载卷，启动时这段代码也能保证它存在。

## 大小限制要加在解析阶段

`limits` 是 multer 最容易被忽略、也最容易出事的一段配置。它不是一个“建议值”，而是传送带上的秤：边读边称，字节数一超，立刻停带子并抛 `MulterError`。

```ts
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 10,
    parts: 20,
    fieldSize: 1024,
  },
});
```

- `fileSize` 管单个文件，单位是字节。
- `files` 管文件个数，`files: 1` 表示多传一个就报错。
- `fields` 管普通字段个数，`fieldSize` 管单个字段的字节数（默认 1 MB，攻击者可以用大量超长字段把内存撑爆）。
- `parts` 管总段数，必须大于等于 `files + fields`。卡得太死，合法请求会被 `LIMIT_PART_COUNT` 误杀，而且报错信息看起来像是“文件太多”，很容易误判。

为什么不能等落盘之后再 `stat` 一下大小？因为那时字节已经写完了。5 GB 的请求会把网关、磁盘和进程内存全部占满，然后你才告诉客户端“太大了”。限制必须发生在读的过程中。这跟小区门禁是一个道理：在门口拦，别等人家把车开进地库再拦。

## MIME 声明只能当线索

`fileFilter` 在落盘前执行，拿不到文件内容，只能看客户端声明。它能做的是“便宜的初筛”：类型不在白名单里就直接拒，省掉一次写盘。

```ts
export class UnsupportedFileTypeError extends Error {
  readonly statusCode = 415;

  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileTypeError';
  }
}

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 10, parts: 20, fieldSize: 1024 },
  fileFilter: (_req, file, callback) => {
    if (!MIME_EXT.has(file.mimetype)) {
      callback(new UnsupportedFileTypeError(`unsupported type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
});
```

注意 `fileFilter` 的 `callback` 只接受两个参数：`callback(null, true)` 收下，`callback(null, false)` 跳过这个文件（不会报错，只是 `req.file` 为空），`callback(error)` 中断整个请求。用 `false` 还是 `error` 取决于你想不想让客户端看到明确原因——类型不对应该给 415，而不是静默丢弃。

真正的内容判断只能读文件头。PNG 的前 8 个字节、JPEG 的前 3 个字节、WebP 的 `RIFF....WEBP` 结构，都是格式规范里写死的 **magic number**（魔数）。你可以把它当成文件的防伪钢印：伪装者可以把名字改成 `.png`，但开头这几个字节改不了。读 12 个字节就够，不要为了判断类型把整个文件读进内存——那等于把刚省下的内存又还回去了。

```ts
// src/image.ts
import { open } from 'node:fs/promises';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const detectImageMime = async (path: string): Promise<string | undefined> => {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 12) return undefined;
    if (header.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
    const riff = header.subarray(0, 4).toString('latin1');
    const webp = header.subarray(8, 12).toString('latin1');
    if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
    return undefined;
  } finally {
    await handle.close();
  }
};
```

魔数只能证明“开头像图片”，证明不了“这是一张能解码的图片”。三种绕过方式值得记住：

- 在合法图片后面追加脚本，形成 polyglot 文件——一本既能当菜谱、又能当说明书的书，图片解码器忽略尾部，某些解析器却会执行；
- 把 HTML 写成 `.png`，浏览器靠内容嗅探把它当页面渲染，这就是存储型 XSS；
- 压缩炸弹：几百 KB 的 PNG 解压后占用几 GB 像素内存，像一只巴掌大的箱子，打开弹出一座充气城堡。

对头像这类会二次分发的资源，再加一步“解码后重编码”：用 `sharp` 读进来，按目标尺寸重新输出。既验证了可解码性，又剥掉了 EXIF 里的定位信息，还把上面三种情况一次性消掉。SVG 和 CSV 没有二进制魔数，这套对它们无效——只接受白名单内的二进制格式，比给每种文本格式写校验规则可靠得多。

## 把错误翻译成状态码

multer 抛出的错误有两种：`MulterError`（带 `code`，比如 `LIMIT_FILE_SIZE`）和你自己抛的 `UnsupportedFileTypeError`。它们必须被翻译成不同的 HTTP 状态码，否则前端只能看到笼统的 500。

把前面 `server.ts` 里的路由搬进 `app.ts`，顺手补上错误中间件。`app.ts` 只负责组装，不监听端口——监听交给后面的 `main.ts`，测试时可以直接拿 `app` 发请求，不用真的占一个端口。

```ts
// src/app.ts
import { rm } from 'node:fs/promises';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { detectImageMime } from './image.js';
import { UPLOAD_DIR, UnsupportedFileTypeError, upload } from './upload.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.post('/api/uploads', upload.single('file'), async (req: Request, res: Response) => {
  if (req.file === undefined) {
    res.status(400).json({ code: 'FILE_REQUIRED', message: 'field "file" is required' });
    return;
  }

  const detected = await detectImageMime(req.file.path);
  if (detected !== req.file.mimetype) {
    await rm(req.file.path, { force: true });
    throw new UnsupportedFileTypeError(
      `declared ${req.file.mimetype}, content looks like ${detected ?? 'unknown'}`,
    );
  }

  res.status(201).json({
    data: {
      id: req.file.filename,
      name: req.file.originalname,
      type: detected,
      size: req.file.size,
      url: `/files/${req.file.filename}`,
    },
  });
});

app.use('/files', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny', maxAge: '1h' }));

app.use((_req: Request, res: Response) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'route not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ code: error.code, message: 'upload rejected by limits' });
    return;
  }
  if (error instanceof UnsupportedFileTypeError) {
    res.status(error.statusCode).json({ code: 'UNSUPPORTED_FILE_TYPE', message: error.message });
    return;
  }
  console.error('unhandled upload error', error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'internal server error' });
});
```

入口单独放一个文件，负责把服务跑起来：

```ts
// src/main.ts
import { app } from './app.js';

app.listen(3000, () => console.log('upload server listening on http://localhost:3000'));
```

几个细节：

- Express 5 会自动把 async handler 里抛出的 rejection 转给错误中间件，所以这里可以直接 `throw`，不用 `next(error)`。
- 错误中间件必须**四个参数**且放在最后。少一个参数，Express 会把它当成普通中间件，错误就沉下去了。
- 校验失败时先用 `rm` 删掉临时文件，再抛错。`diskStorage` 不会替你清理已经落盘的内容。
- 413 表示体积超限，415 表示类型不支持，400 表示请求本身不合法。前端要按状态码或 `code` 分支，否则用户看到的永远是“网络异常”。

`express.static` 只适合本地开发或内网。上传目录一旦能被同源访问，SVG 和 HTML 就可能变成存储型 XSS 的载体。生产环境把下载放到独立域名，给非图片资源加 `Content-Disposition: attachment`，或者干脆只保存对象 key，下载走对象存储的预签名 URL。

对象存储的接法值得展开一句：浏览器先向你的服务要一个预签名 PUT URL，拿到后直接把文件传给 S3 或 MinIO，字节根本不经过 Node 进程。应用只存 `bucket/key` 和元数据，扩容、限流、生命周期清理都交给存储侧。代价是多一套凭证和桶策略要管，本地开发还得起 MinIO——日活几千的内网工具，用磁盘加鉴权路由反而更省事。

> **图 23-1** 一次上传请求在 Express 里经过的关卡，以及每道关卡失败时对应的状态码。

```mermaid
flowchart LR
  A["multipart 请求"] --> B["express.json 跳过"]
  B --> C["multer 解析"]
  C --> D{"超过 limits?"}
  D -- 是 --> E["MulterError → 413/400"]
  D -- 否 --> F{"fileFilter 通过?"}
  F -- 否 --> G["UnsupportedFileTypeError → 415"]
  F -- 是 --> H["diskStorage 写盘"]
  H --> I["读 magic number"]
  I -- 不符 --> J["rm 后返回 415"]
  I -- 相符 --> K["201 + 元数据"]
```

## 真跑一遍

下面这些输出来自实际运行（Express 5.3.0、multer 2.5.0）。Node 22.18 起内置类型剥离，`node` 能直接跑 `.ts`，不需要额外的运行时——本机是更新的版本，语法一致。

```bash
node --watch src/main.ts
# upload server listening on http://localhost:3000

# 1. 正常上传
curl -s -F "file=@fixtures/pixel.png;type=image/png" http://localhost:3000/api/uploads
# {"data":{"id":"5afa3780-8a9a-473e-873f-5c5a48358e1d.png","name":"pixel.png","type":"image/png","size":70,"url":"/files/5afa3780-....png"}}
```

```bash
# 2. 内容与声明不符：声明 image/png，实际是文本
curl -s -F "file=@README.md;filename=fake.png;type=image/png" http://localhost:3000/api/uploads
# {"code":"UNSUPPORTED_FILE_TYPE","message":"declared image/png, content looks like unknown"}

# 3. 没带文件字段
curl -s -X POST http://localhost:3000/api/uploads
# {"code":"FILE_REQUIRED","message":"field \\"file\\" is required"}

# 4. 超过 5 MB
head -c 6291456 /dev/zero > /tmp/too-large.png
curl -s -F "file=@/tmp/too-large.png;type=image/png" http://localhost:3000/api/uploads
# {"code":"LIMIT_FILE_SIZE","message":"upload rejected by limits"}

# 5. 类型根本不在白名单（在 fileFilter 就被拒）
curl -s -F "file=@README.md;type=text/plain" http://localhost:3000/api/uploads
# {"code":"UNSUPPORTED_FILE_TYPE","message":"unsupported type: text/plain"}
```

对应的状态码分别是 `201`、`415`、`400`、`413`、`415`。再确认落盘和静态访问：

```bash
ls -lh storage/uploads
# -rw-r--r-- 1 you staff 70B 5afa3780-....png
file storage/uploads/*.png
# PNG image data, 1 x 1, 8-bit/color RGBA, non-interlaced
curl -sI http://localhost:3000/files/5afa3780-....png | head -3
# HTTP/1.1 200 OK
# Accept-Ranges: bytes
# Cache-Control: public, max-age=3600
```

第 4 条说明了 `limits` 和 MIME 白名单谁也不能替代谁：这个请求的声明类型是 `image/png`，能过 `fileFilter`，最后死在 `fileSize` 上。

## 线上真正会踩的坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `req.file` 是 `undefined` | 表单字段名和 `upload.single()` 不一致，或请求不是 multipart | 两边 key 对齐；用 `curl -F`，不要用 `-d` |
| 413 但应用日志没有记录 | Nginx / Ingress 在更外层就拒了 | 同时调 `client_max_body_size` / `proxy-body-size` |
| 上传大文件时内存飙升 | 用了默认的 `memoryStorage` | 大文件换 `diskStorage`，并限制并发 |
| 文件是 0 字节 | 客户端中途断开，或进程在写盘时被杀 | 先写临时名，校验后原子 rename；启动时清理残留 |
| 415 但前端提示“网络错误” | 错误响应被 CORS 或网关改写 | 保证错误体是 JSON，CORS 暴露状态码，前端按 `code` 分支 |
| `ENOSPC` 直接把进程打挂 | 没处理写盘失败 | 捕获存储错误返回 503，磁盘水位单独监控 |

还有几条适合写进 checklist 的：

- **限额要分层**。网关限制整个请求体，应用限制单文件，业务层再限制每用户配额。只配一层，另一层就会在流量峰值上教你做人。
- **临时文件要能清理**。进程被 kill 时 multer 来不及删半截文件，启动时按 mtime 扫一遍临时目录，比事后人工 `rm` 可靠。
- **日志只记元数据**。记大小、真实类型、耗时和结果码，不记文件内容，也不要原样打印 `originalname` 里的控制字符——日志注入和 PII 泄露往往从这一行开始。

一条上传链路其实有四道闸门，分工不同、失败语义也不同：网关按整个请求体算，解析器按单文件和 part 算，业务层看魔数、配额和权限，存储层管容量和生命周期。把每一道放在正确的位置，上传才算真正可运维。

Express 这边的手工接线到这里就完整了。下一章把这些能力搬进 Nest：`FileInterceptor` 会替你挂好 multer，但 storage 选内存还是磁盘、校验放在 Pipe 还是 Service，顺序变了，坑也跟着变。


<!-- chapter-nav:start -->
---

← 上一篇：[022 图解串一串Nest核心概念](022-图解串一串Nest核心概念.md) · [本 Part 目录](_part.md) · 下一篇：[024 Nest如何使用multer实现文件上传](024-Nest如何使用multer实现文件上传.md) →
<!-- chapter-nav:end -->
