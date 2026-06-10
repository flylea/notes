# Nginx 反向代理与静态资源

## 反向代理 vs 正向代理

```
正向代理（VPN/Clash）：
  你 → 代理服务器 → 目标网站
  代理代表"你"去访问

反向代理（Nginx）：
  浏览器 → Nginx → Nest 应用
  代理代表"服务器"接收请求

  Nginx 就是 Nest 应用的"前台接待"
```

## 基本反向代理配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name api.example.com;

    # 反向代理到 Nest 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 静态资源托管

```nginx
server {
    listen 80;
    server_name www.example.com;

    # 前端 SPA——托管在 /var/www/book-app
    location / {
        root /var/www/book-app;
        index index.html;
        try_files $uri $uri/ /index.html;  # SPA 路由 fallback
    }

    # API——代理到后端
    location /user {
        proxy_pass http://localhost:3000;
    }

    location /book {
        proxy_pass http://localhost:3000;
    }

    location /borrow {
        proxy_pass http://localhost:3000;
    }

    # 上传文件——直接由 Nginx 提供
    location /uploads {
        alias /app/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## 完整生产级 Nginx 配置

```nginx
# /etc/nginx/conf.d/book-management.conf
upstream book_api {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.bookmanagement.com;

    # 禁止 IP 直接访问
    if ($host != "api.bookmanagement.com") {
        return 444;
    }

    # 限制请求速率——防 DDoS
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # 限制请求体大小
    client_max_body_size 10M;

    # Gzip 压缩
    gzip on;
    gzip_types application/json text/plain;
    gzip_min_length 1000;

    # 安全头
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://book_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # 静态资源
    location /uploads/ {
        alias /app/uploads/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # 健康检查端点
    location /health {
        proxy_pass http://book_api;
        access_log off;
    }
}
```

## location 匹配优先级

```
= /exact      精确匹配（最高优先级）
^~ /prefix    前缀匹配（匹配后不再搜索正则）
~ \.php$      区分大小写的正则匹配
~* \.jpg$     不区分大小写的正则匹配
/             普通前缀匹配（最低优先级）

示例：
  location = /health        → 只匹配 /health
  location ^~ /api/         → 匹配 /api/xxx
  location ~* \.(jpg|png)$  → 匹配图片后缀
  location /                → 匹配所有（兜底）
```

---

## 参考链接

- [Nginx — Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Nginx — Static Content](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/)
