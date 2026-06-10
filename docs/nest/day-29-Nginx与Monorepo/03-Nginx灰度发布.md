# Nginx 灰度发布

## 什么是灰度发布

```
传统发布：
  100% 用户 → 旧版本 → 停服 → 100% 用户 → 新版本
                       ↑ 出问题全员受影响

灰度发布（金丝雀发布）：
  5% 用户 → 新版（验证没问题后逐步放量）
  95% 用户 → 旧版（稳定运行）
```

名字来源：矿工下井前先放一只金丝雀——如果金丝雀死了，说明有毒气，人就不能下去。新版本就是"金丝雀"。

> 前端类比：Vue/React 项目上线后通过实验平台（AB 实验）做功能开关，只对 5% 用户开启新 UI，就是灰度的思想。只不过灰度发布更底层——连代码版本都不同。

## 方案 1：split_clients 按用户分流

Nginx 的 `split_clients` 模块可以按变量 hash 将流量分成不同的组：

```nginx
# /etc/nginx/nginx.conf 的 http 块

# 按用户 IP hash 分流（同一 IP 始终访问同一版本）
split_clients "${remote_addr}AAA" $app_version {
    5%    v2;     # 5% 流量到新版
    *     v1;     # 其余到旧版
}

upstream book_api_v1 {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

upstream book_api_v2 {
    server 127.0.0.1:3003;
    server 127.0.0.1:3004;
}

server {
    listen 80;
    server_name api.bookmanagement.com;

    location / {
        # 根据 split_clients 计算结果选择 upstream
        proxy_pass http://book_api_$app_version;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-App-Version $app_version;  # 响应头带版本号，方便排查
    }
}
```

**逐步放量流程**：

```nginx
# 阶段 1：内测——只有白名单 IP 到 v2
split_clients "${remote_addr}AAA" $app_version {
    *     v1;     # 默认全部到 v1
}

# 配合 map 实现白名单
map $remote_addr $app_version {
    10.0.0.100  v2;    # 开发 A 的 IP
    10.0.0.101  v2;    # 开发 B 的 IP
    default     v1;
}

# 阶段 2：5% 灰度
split_clients "${remote_addr}AAA" $app_version {
    5%    v2;
    *     v1;
}

# 阶段 3：50% 灰度
split_clients "${remote_addr}AAA" $app_version {
    50%   v2;
    *     v1;
}

# 阶段 4：全量
# 直接改 upstream，去掉 v1
```

## 方案 2：Cookie 染色（精确控制）

适合需要精确控制哪些用户走灰度的场景——比如只给内部员工或特定测试用户开放新版。

```nginx
server {
    listen 80;
    server_name api.bookmanagement.com;

    # 检查 Cookie 中是否有 canary=1
    set $upstream "book_api_v1";

    if ($http_cookie ~* "canary=1") {
        set $upstream "book_api_v2";
    }

    # 也支持通过请求头切换（方便 Postman 测试）
    if ($http_x_canary = "1") {
        set $upstream "book_api_v2";
    }

    location / {
        proxy_pass http://$upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 如果走 v2，在响应中设置 Cookie（持久化用户染色）
        add_header Set-Cookie "canary=1; Path=/; Max-Age=86400" always;
    }
}
```

**染色方式对比**：

| 方式 | 粒度 | 持久性 | 适用场景 |
|------|------|--------|---------|
| IP Hash | IP 级别 | 天然持久 | 随机灰度 |
| Cookie | 用户级别 | 持久 | 白名单灰度 |
| Header | 单次请求 | 临时 | 测试/调试 |
| User ID | 用户级别 | 逻辑持久 | 按用户属性灰度 |

## 方案 3：Nginx + Lua（OpenResty）高级灰度

生产级灰度系统通常用 OpenResty（Nginx + Lua）实现更灵活的规则：

```lua
-- 在 OpenResty 中用 Lua 脚本实现灰度逻辑
-- /etc/nginx/conf.d/grayscale.lua

local redis = require "resty.redis"
local red = redis:new()
red:connect("127.0.0.1", 6379)

-- 从请求头获取用户 ID
local user_id = ngx.req.get_headers()["X-User-Id"]

if user_id then
    -- 查 Redis：该用户是否在灰度白名单中
    local is_canary = red:get("canary:user:" .. user_id)

    if is_canary == "1" then
        ngx.var.app_upstream = "book_api_v2"
        return
    end

    -- 查 Redis：该用户所在公司是否开放灰度
    local company_id = red:get("user:company:" .. user_id)
    if company_id then
        local company_canary = red:get("canary:company:" .. company_id)
        if company_canary == "1" then
            ngx.var.app_upstream = "book_api_v2"
            return
        end
    end
end

-- 默认走稳定版
ngx.var.app_upstream = "book_api_v1"
```

**OpenResty 方案的优势**：
- 灰度规则实时生效（无需 `nginx -s reload`）
- 支持复杂条件组合（用户属性 + 地域 + 设备 + 时间窗口）
- 可接入后端管理台，运营自助灰度

## 灰度发布完整流程

```
第 1 步：部署 v2 容器
  docker-compose up -d --scale api_v2=2

第 2 步：Nginx 配置 5% 流量到 v2
  split_clients 5% → v2

第 3 步：观察监控指标（持续 30 分钟）
  - 错误率（v2 vs v1）
  - 响应时间 P50/P99
  - CPU/内存使用率
  - 数据库慢查询

第 4 步：逐步放量
  5% → 20% → 50% → 100%
  每步观察 30 分钟，有问题立刻回滚

第 5 步：全量切换
  - 移除 v1 upstream
  - 或者直接把 v2 配置改成 v1 的 server 列表
  - 旧容器下线
```

## 灰度期间的数据库兼容性

这是灰度发布中最容易出问题的地方——v1 和 v2 共享同一个数据库：

```prisma
// ❌ 危险做法：直接在 v2 删除 v1 还在用的字段
model Book {
  // v2 删掉了 publishedAt，但 v1 还在读写它→ 数据不一致
}

// ✅ 安全做法：分两步
// 第 1 步（v1.1）：两套代码对字段"新写旧读"
//   - v1 继续正常读写 publishedAt
//   - v1.1 写入 publishDate 的同时也写入 publishedAt（双写）
//   - v1.1 优先读 publishDate，没有则读 publishedAt（兼容读）

// 第 2 步（v2.0）：等 v1 下线后再删旧字段
//   - v2 只读写 publishDate
//   - 下次 migration 删除 publishedAt 列
```

**数据库变更的灰度安全法则**：

| 操作 | 安全性 | 说明 |
|------|--------|------|
| 新增表 | 安全 | 旧代码不访问新表 |
| 新增列（可空） | 安全 | 旧 INSERT 自动填 NULL |
| 新增列（有默认值） | 基本安全 | 注意大表加列的锁表时间 |
| 修改列类型 | 危险 | 必须先确保两版都能读写新类型 |
| 删除列 | 危险 | 等旧版下线后再删 |
| 重命名列 | 危险 | 双写过渡期后再删旧的 |

## 快速回滚

```bash
# Nginx 一键回滚：把灰度比例改成 0
# 或者直接 reload 上一个版本的 nginx 配置

# 容器回滚
docker-compose up -d --scale api_v1=3 --scale api_v2=0
```

```nginx
# 紧急回滚配置——全部切回 v1
split_clients "${remote_addr}AAA" $app_version {
    0%    v2;     # ← 0%
    *     v1;
}
# nginx -s reload  立即生效
```

---

## 参考链接

- [Nginx — split_clients Module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html)
- [Nginx — map Module](https://nginx.org/en/docs/http/ngx_http_map_module.html)
- [OpenResty — Official Site](https://openresty.org/)
- [Martin Fowler — Canary Release](https://martinfowler.com/bliki/CanaryRelease.html)
