# JWT 结构详解

## Token 的结构

JWT 由三部分组成，用 `.` 分隔：

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoiYWxpY2UifQ.4LqM5n-pF8KxR2tY3vZ1wX7hB9jQ0kLmN3oP6sA8dE

┌──────────────────────┬──────────────────────────────────────┬────────────────────────────┐
│       Header          │              Payload                 │         Signature          │
│      (头部)           │              (载荷)                  │          (签名)            │
└──────────────────────┴──────────────────────────────────────┴────────────────────────────┘
```

## Header（头部）

声明 Token 类型和签名算法：

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

经过 Base64URL 编码后变成：`eyJhbGciOiJIUzI1NiJ9`

```
alg 选项：
  HS256 — HMAC + SHA256（对称加密，一个密钥）
  RS256 — RSA + SHA256（非对称加密，公钥/私钥对）
  ES256 — ECDSA + SHA256（椭圆曲线，性能更好）

typ 固定为 "JWT"
```

## Payload（载荷）

存放"声明"（Claims）——即要传递的数据：

```json
{
  "sub": 1,
  "username": "alice",
  "role": "USER",
  "iat": 1705312000,
  "exp": 1705398400
}
```

经过 Base64URL 编码后变成：`eyJzdWIiOjEsInVzZXJuYW1lIjoiYWxpY2UifQ`

### 声明分类

```typescript
// 1. 注册声明（Registered Claims）——标准字段
{
  "iss": "book-management-api",  // issuer，签发者
  "sub": 1,                       // subject，主体（通常是 userId）
  "aud": "book-app",              // audience，接收方
  "exp": 1705398400,              // expiration time，过期时间
  "nbf": 1705312000,              // not before，生效时间
  "iat": 1705312000,              // issued at，签发时间
  "jti": "unique-token-id"        // JWT ID，唯一标识
}

// 2. 公开声明（Public Claims）——自定义字段
{
  "username": "alice",
  "role": "USER",
  "nickname": "Alice"
}

// 3. 私有声明（Private Claims）——应用间共享
{
  "permissions": ["book:read", "book:borrow"]
}
```

## Signature（签名）

用于验证 Token 没有被篡改：

```javascript
// HMAC-SHA256 签名过程
const signature = HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret  // 密钥，只有服务器知道
);
```

```
验证流程：

  收到 Token → 用同样的 secret 重新计算签名
                    │
                    ▼
              签名一致？─── 是 → Token 有效，信任 Payload
                    │
                    否 → Token 被篡改，拒绝
```

> 所以 JWT 不能存放敏感信息！Payload 只是 Base64 编码（不是加密），任何人都可以解码查看。

## JWT 安全原理

```typescript
// 攻击者尝试篡改 Payload
收到 Token: eyJxxx.yyyy.zzzz

// 攻击者解码 Payload，把 username 从 "alice" 改成 "admin"：
新 Payload: { "sub": 1, "username": "admin" }

// 但攻击者没有 secret，无法生成合法签名
// 服务器重新计算签名：
HMACSHA256(header + "." + 篡改后的payload, secret)
  ≠ 原签名 zzzz

// → 验证失败，拒绝请求
```

**核心**：Payload 可读但不可改。签名保证了数据完整性。

## 实战：在浏览器中解析 JWT

```javascript
// 在浏览器 Console 中
const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoiYWxpY2UifQ.xxx';

// 解析 Payload
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// { sub: 1, username: "alice" }
```

> 这就是为什么 JWT 不能存密码——任何人都可以 base64 解码看到内容。

## HS256 vs RS256

| | HS256 | RS256 |
|---|------|------|
| 密钥类型 | 单个 secret 字符串 | 公钥/私钥对 |
| 谁签发 | 只有知道 secret 的服务 | 持有私钥的服务 |
| 谁验证 | 知道 secret 的任何服务 | 持有公钥的任何服务 |
| 适用场景 | 单服务/简单应用 | 微服务/多服务验证 |
| 密钥管理 | secret 泄露 = 全部沦陷 | 私钥严格保密，公钥可分发 |

```bash
# RS256 密钥生成
# 生成私钥
openssl genrsa -out private.pem 2048

# 从私钥提取公钥
openssl rsa -in private.pem -pubout -out public.pem
```

```typescript
// 微服务场景：认证服务用私钥签发，其他服务用公钥验证
// Auth Service (持有私钥)
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

// Book Service (只需公钥)
const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

> 图书管理系统初始阶段用 HS256 即可。微服务阶段再考虑升级到 RS256。

## Payload 设计最佳实践

```typescript
// ✅ 好的 Payload——小而精
{
  "sub": 1,           // 用户 ID（必备）
  "username": "alice", // 用于日志/展示
  "role": "USER",      // 用于简单权限判断
  "iat": 1705312000,  // 签发时间
  "exp": 1705398400   // 过期时间
}

// ❌ 坏的 Payload——太大
{
  "sub": 1,
  "username": "alice",
  "nickname": "Alice Wang",
  "avatar": "https://cdn.example.com/avatars/alice.jpg",
  "email": "alice@example.com",
  "phone": "13800138000",
  "address": "北京市朝阳区...",
  "permissions": ["book:read", "book:create", "book:update", "book:delete", ...], // 100 个权限
  "createdAt": "2024-01-01T00:00:00.000Z"
}
// Token 体积过大，每次请求都带 1KB+ 的 Header
// permissions 应该从数据库/缓存查，不要放 Token 里
```

**原则**：JWT Payload 只放**身份标识**（sub/username/role），不放业务数据。

---

## 参考链接

- [JWT.io — Debugger](https://jwt.io/)
- [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [Auth0 — RS256 vs HS256](https://auth0.com/blog/rs256-vs-hs256-whats-the-difference/)
