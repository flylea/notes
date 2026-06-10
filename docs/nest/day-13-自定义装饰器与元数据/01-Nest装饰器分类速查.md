# Nest 装饰器分类速查

## 装饰器在 Nest 中的角色

Nest 是建立在装饰器上的框架。装饰器不仅用于声明式编程，更重要的是——**它们携带的元数据是 DI 容器和切面系统运作的基础**。

## 四大类装饰器

### 1. 类装饰器（Class Decorators）

| 装饰器 | 作用 |
|--------|------|
| `@Module(metadata)` | 声明模块，定义 imports/controllers/providers/exports |
| `@Injectable()` | 声明可注入的 Provider |
| `@Controller(prefix)` | 声明控制器，指定路由前缀 |
| `@Global()` | 声明全局模块 |
| `@Catch(...exceptions)` | 声明异常过滤器捕获的类型 |

### 2. 方法装饰器（Method Decorators）

| 装饰器 | 作用 |
|--------|------|
| `@Get(path)` | 绑定 GET 路由 |
| `@Post(path)` | 绑定 POST 路由 |
| `@Put(path)` | 绑定 PUT 路由 |
| `@Delete(path)` | 绑定 DELETE 路由 |
| `@Patch(path)` | 绑定 PATCH 路由 |
| `@Options(path)` | 绑定 OPTIONS 路由 |
| `@Head(path)` | 绑定 HEAD 路由 |
| `@All(path)` | 绑定所有方法 |
| `@HttpCode(status)` | 设置响应状态码 |
| `@Header(name, value)` | 设置响应头 |
| `@Redirect(url, status)` | 设置重定向 |

### 3. 参数装饰器（Parameter Decorators）

| 装饰器 | 作用 |
|--------|------|
| `@Body(key?)` | 提取请求体 |
| `@Query(key?)` | 提取 Query String |
| `@Param(key?)` | 提取路径参数 |
| `@Headers(name?)` | 提取请求头 |
| `@Req()` | 获取完整 Request 对象 |
| `@Res()` | 获取完整 Response 对象 |
| `@Session()` | 获取 Session |
| `@Ip()` | 获取客户端 IP |
| `@HostParam()` | 获取主机名参数 |
| `@UploadedFile()` | 获取上传的单个文件 |
| `@UploadedFiles()` | 获取上传的多个文件 |

### 4. 切面装饰器与元数据装饰器

| 装饰器 | 作用 |
|--------|------|
| `@UseGuards(...guards)` | 绑定 Guard |
| `@UseInterceptors(...interceptors)` | 绑定 Interceptor |
| `@UsePipes(...pipes)` | 绑定 Pipe |
| `@UseFilters(...filters)` | 绑定 ExceptionFilter |
| `@SetMetadata(key, value)` | 设置元数据（供 Reflector 读取） |
| `@SerializeOptions(options)` | 设置序列化选项 |

## 装饰器的执行时机

```typescript
// TypeScript 装饰器的执行时机：

// 1. 类装饰器：类声明时执行（项目启动时）
// 2. 方法装饰器：类声明时执行（项目启动时）
// 3. 参数装饰器：类声明时执行（项目启动时）
// ─── 以上都是启动时执行，不是运行时 ───

// 4. 方法体内的逻辑：请求到达时执行（运行时）
```

这就是为什么 `@Controller('book')` 在启动时就被 Nest 读取，构建路由表。装饰器本质上是**编译时/启动时的代码生成**。

## Decorator 的 TypeScript 类型签名

```typescript
// 类装饰器
function ClassDecorator(constructor: Function): void | Function;

// 方法装饰器
function MethodDecorator(
  target: Object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): void | PropertyDescriptor;

// 参数装饰器
function ParameterDecorator(
  target: Object,
  propertyKey: string | symbol | undefined,
  parameterIndex: number,
): void;

// 属性装饰器
function PropertyDecorator(
  target: Object,
  propertyKey: string | symbol,
): void;
```

## 装饰器的参数工厂模式

Nest 大多数装饰器都是"参数工厂"——装饰器函数本身返回另一个装饰器函数：

```typescript
// 参数工厂模式
@Get('list')      // @Get = 返回方法装饰器的函数
@UseGuards(AuthGuard)  // @UseGuards = 返回方法装饰器的函数
@Body('username')  // @Body = 返回参数装饰器的函数
```

```typescript
// @Get 的内部实现（简化版）
function Get(path?: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    // target = Controller.prototype
    // propertyKey = 方法名
    Reflect.defineMetadata('path', path, target[propertyKey]);
    Reflect.defineMetadata('method', 'GET', target[propertyKey]);
  };
}
```

> 理解装饰器的工厂模式，是写自定义装饰器的前提。Day 13 后半部分会手写 `@RequirePermission` 和 `@UserInfo`。

---

## 参考链接

- [NestJS — Custom Decorators](https://docs.nestjs.com/custom-decorators)
- [TypeScript — Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
- 开源笔记：《Nest 通关秘籍》.doc/12.装饰器.md
