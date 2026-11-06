/**
 * 运行时枚举镜像。
 *
 * 数据库枚举的唯一事实来源是 `prisma/contract.prisma`；但 class-validator 的
 * `@IsEnum`、Swagger 的 `enum` 以及业务代码里的比较都需要运行时对象。
 * 这里用 `as const` 对象提供同样的取值，新增枚举值时两边要同步修改。
 *
 * 之所以不用 TypeScript `enum`：契约生成的是字符串字面量联合类型，
 * `as const` 对象的每个值天然就是字面量，赋值给 Prisma 输入类型不需要断言。
 */

/** 用户角色。 */
export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** 会议室状态。维护中的会议室不可预订。 */
export const RoomStatus = {
  AVAILABLE: 'AVAILABLE',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

/** 预订状态。PENDING / APPROVED 占用时间段。 */
export const BookingStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];
