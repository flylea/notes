# Redis Geo + 高德地图实现附近搜索

## Geo 使用场景

```
图书管理系统扩展场景：
  - 附近的共享图书（类似"图书漂流"）
  - 按距离排序的图书馆检索
  - 同城书友匹配
```

## Redis Geo 命令

```bash
# 添加位置信息(经度, 纬度, 名称)
GEOADD libraries 116.404 39.915 "国家图书馆"
GEOADD libraries 116.358 39.968 "海淀图书馆"
GEOADD libraries 116.484 39.913 "朝阳图书馆"
GEOADD libraries 116.310 39.990 "北京大学图书馆"

# 查找附近（半径 5km 内的图书馆）
GEORADIUS libraries 116.397 39.908 5 km WITHCOORD WITHDIST

# 计算两点距离
GEODIST libraries "国家图书馆" "海淀图书馆" km

# 获取位置坐标
GEOPOS libraries "国家图书馆"
```

## Nest 中封装 Geo 服务

```typescript
// src/geo/geo.service.ts
@Injectable()
export class GeoService {
  constructor(private redis: RedisService) {}

  // 添加商户/图书馆位置
  async addLocation(key: string, lng: number, lat: number, member: string) {
    // Redis GEOADD key longitude latitude member
    await this.redis.client.geoadd(key, lng, lat, member);
  }

  // 查找附近
  async searchNearby(
    key: string,
    lng: number,
    lat: number,
    radius: number,
    unit: 'm' | 'km' = 'km',
    limit = 20,
  ) {
    // GEORADIUS key longitude latitude radius unit WITHDIST WITHCOORD COUNT limit ASC
    const results = await this.redis.client.georadius(
      key,
      lng,
      lat,
      radius,
      unit,
      'WITHDIST',
      'WITHCOORD',
      'COUNT',
      limit,
      'ASC',  // 从近到远排序
    );

    // results: [["member1", "1.2", ["116.404", "39.915"]], ...]
    return results.map(([member, distance, [lng, lat]]: any) => ({
      member,
      distance: parseFloat(distance).toFixed(2) + unit,
      lng: parseFloat(lng),
      lat: parseFloat(lat),
    }));
  }

  // 计算两点距离
  async getDistance(key: string, member1: string, member2: string, unit: 'm' | 'km' = 'km') {
    const distance = await this.redis.client.geodist(key, member1, member2, unit);
    return distance ? parseFloat(distance) : null;
  }
}
```

## 配合高德地图 API

```typescript
// src/geo/amap.service.ts
@Injectable()
export class AmapService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://restapi.amap.com/v3';

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow('AMAP_API_KEY');
  }

  // 地址 → 坐标（地理编码）
  async geocode(address: string) {
    const resp = await fetch(
      `${this.baseUrl}/geocode/geo?key=${this.apiKey}&address=${encodeURIComponent(address)}`,
    );
    const data = await resp.json();

    if (data.status === '1' && data.geocodes.length > 0) {
      const location = data.geocodes[0].location.split(',');
      return { lng: parseFloat(location[0]), lat: parseFloat(location[1]) };
    }
    return null;
  }

  // 坐标 → 地址（逆地理编码）
  async regeocode(lng: number, lat: number) {
    const resp = await fetch(
      `${this.baseUrl}/regeocode?key=${this.apiKey}&location=${lng},${lat}`,
    );
    return resp.json();
  }
}
```

> Redis Geo 的空间索引基于 GeoHash 算法，适合"附近 5 公里"这种查询。如果场景需要复杂地理计算（多边形、路径规划），使用 PostGIS 扩展更合适。

---

## 参考链接

- [Redis — Geo Commands](https://redis.io/commands/?group=geo)
- [高德地图开放平台](https://lbs.amap.com/)
