# Reflect Metadata 底层原理

## Reflect Metadata 是什么

`reflect-metadata` 是一个 polyfill，在 ES 的 `Reflect` 对象上添加了 `defineMetadata` 和 `getMetadata` 方法。它允许在对象/方法/参数上**额外存储数据**，而不改变其行为。

```typescript
import 'reflect-metadata';

class MyClass {
  @Reflect.metadata('role', 'admin')
  myMethod() {}
}

// 读取元数据
const role = Reflect.getMetadata('role', MyClass.prototype, 'myMethod');
console.log(role);  // 'admin'
```

## Nest 如何使用 Reflect Metadata

Nest 的内核在启动时大量使用 `Reflect.getMetadata`：

```typescript
// Nest 内部使用 design:paramtypes 实现 DI

// 1. TypeScript emitDecoratorMetadata 自动生成元数据
class UserController {
  constructor(private userService: UserService) {}
}
// 编译时 TS 自动添加：Reflect.defineMetadata('design:paramtypes', [UserService], UserController)

// 2. Nest 启动时读取元数据
const paramTypes = Reflect.getMetadata('design:paramtypes', UserController);
// paramTypes = [UserService] → Nest DI 容器知道要注入 UserService
```

## TypeScript 自动生成的三种 metadata

当 `tsconfig.json` 中 `emitDecoratorMetadata: true` 时：

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
class MyService {
  constructor(private db: Database) {}
  getData(@Body() dto: SomeDto): Promise<string> { return null; }
}
```

TypeScript 编译后会自动生成：

```typescript
// 1. 构造函数参数类型
Reflect.defineMetadata('design:paramtypes', [Database], MyService);

// 2. 方法参数类型
Reflect.defineMetadata('design:paramtypes', [SomeDto], MyService.prototype, 'getData');

// 3. 方法返回值类型
Reflect.defineMetadata('design:returntype', Promise, MyService.prototype, 'getData');

// 4. 属性类型
Reflect.defineMetadata('design:type', Database, MyService.prototype, 'db');
```

Nest 利用这些自动元数据实现了：
- **DI 自动解析**：`design:paramtypes` 告诉 Nest 这个类依赖哪些 Provider
- **ValidationPipe 的类型转换**：`design:type` 告诉 class-transformer 目标类型是什么

## Nest 自定义的 metadata key

除了 TypeScript 自动生成的，Nest 自己也在存储大量元数据：

```typescript
// Nest 存储的元数据（部分）
'path'                    // 路由路径
'method'                  // HTTP 方法
'__module__'              // 所属模块
'__controller__'          // 控制器标记
'__injectable__'          // 可注入标记
'__optional__'            // 可选依赖
'self:paramtypes'         // 自定义参数装饰器类型
'custom:route_args'        // 自定义参数装饰器数据
'roles'                   // @SetMetadata('roles', ...) 的存储 key（你在 Guard 中读的就是这个）
```

## 手动使用 Reflect Metadata

```typescript
import 'reflect-metadata';

// 在类上存储
Reflect.defineMetadata('version', 1, BookController);
Reflect.getMetadata('version', BookController);  // 1

// 在方法上存储
Reflect.defineMetadata('roles', ['admin'], BookController.prototype, 'create');
Reflect.getMetadata('roles', BookController.prototype, 'create');  // ['admin']

// 在属性上存储
Reflect.defineMetadata('required', true, BookController.prototype, 'title');
Reflect.getMetadata('required', BookController.prototype, 'title');  // true
```

## Reflect Metadata 与 @SetMetadata 的关系

`@SetMetadata` 是 Nest 对 `Reflect.defineMetadata` 的一个简单封装：

```typescript
// Nest 源码（简化）
export const SetMetadata = <K = string, V = any>(
  metadataKey: K,
  metadataValue: V,
) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(metadataKey, metadataValue, descriptor.value);
    } else {
      Reflect.defineMetadata(metadataKey, metadataValue, target);
    }
  };
};
```

所以这两种写法是等价的：

```typescript
@SetMetadata('roles', ['admin'])
// 等价于装饰器内部调用
// Reflect.defineMetadata('roles', ['admin'], descriptor.value);
```

## ES Reflect vs reflect-metadata

| | `Reflect.get()` | `Reflect.getMetadata()` |
|---|---|---|
| 来源 | ES6 原生 | reflect-metadata polyfill |
| 作用 | 读取对象的属性 | 读取存储在对象上的元数据 |
| 需要 | 不需要额外安装 | `npm i reflect-metadata` + `import 'reflect-metadata'` |
| Nest 使用 | 不直接使用 | 大量使用 |

Nest 的 `Reflector` 内部调用的就是 `Reflect.getMetadata()`。

> 理解 Reflect Metadata 后，你会发现 Nest 的 Guard/Pipe/Interceptor 之所以能"读取装饰器信息"，本质上都是 `Reflect.getMetadata()` 在工作。

---

## 参考链接

- [Reflect Metadata — Spec](https://rbuckton.github.io/reflect-metadata/)
- [TypeScript — Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
- [NestJS — Reflection and Metadata](https://docs.nestjs.com/fundamentals/reflection-and-metadata)
- 开源笔记：《Nest 通关秘籍》.doc/13.如何使用Reflector读取SetMetadata.md
