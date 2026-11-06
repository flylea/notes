import bcrypt from 'bcryptjs';
import { BookingStatus, Role, RoomStatus } from '../src/common/enums.js';
import { loadEnvFiles } from '../src/config/load-env.js';
import { createDatabase } from '../src/database/prisma.js';

const BCRYPT_ROUNDS = 10;

// Prisma CLI 只自动读 .env；seed 由 tsx 直接运行，这里显式加载 .env.local / .env。
loadEnvFiles();

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('缺少 DIRECT_URL / DATABASE_URL：请先 cp .env.example .env');
  process.exit(1);
}

const db = createDatabase(url);

/** 相对今天 UTC 零点偏移 days 天，再落到 hour 点，返回 ISO 字符串。 */
const slot = (days: number, hour: number): string => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

const main = async (): Promise<void> => {
  // 有外键约束：先清预订，再清会议室与用户。
  await db.orm.public.Booking.where({}).deleteAll();
  await db.orm.public.Room.where({}).deleteAll();
  await db.orm.public.User.where({}).deleteAll();

  const [admin, member] = await db.orm.public.User.createAll([
    {
      name: '管理员',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('Admin123456', BCRYPT_ROUNDS),
      role: Role.ADMIN,
    },
    {
      name: '张三',
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('User123456', BCRYPT_ROUNDS),
      role: Role.USER,
    },
  ]);

  const rooms = await db.orm.public.Room.createAll([
    {
      name: '星河会议室',
      capacity: 12,
      location: 'A 座 3 层',
      equipment: ['投影仪', '白板', '视频会议'],
      status: RoomStatus.AVAILABLE,
    },
    {
      name: '远山会议室',
      capacity: 6,
      location: 'A 座 5 层',
      equipment: ['电视', '白板'],
      status: RoomStatus.AVAILABLE,
    },
    {
      name: '机房改造中',
      capacity: 4,
      location: 'B 座 1 层',
      equipment: [],
      status: RoomStatus.MAINTENANCE,
    },
  ]);

  await db.orm.public.Booking.createAll([
    {
      userId: member.id,
      roomId: rooms[0].id,
      startTime: slot(1, 10),
      endTime: slot(1, 11),
      status: BookingStatus.APPROVED,
      remark: '产品周会',
    },
    {
      userId: admin.id,
      roomId: rooms[1].id,
      startTime: slot(1, 14),
      endTime: slot(1, 15),
      status: BookingStatus.PENDING,
      remark: '面试',
    },
    {
      userId: member.id,
      roomId: rooms[0].id,
      startTime: slot(2, 9),
      endTime: slot(2, 10),
      status: BookingStatus.PENDING,
      remark: null,
    },
  ]);

  console.log('演示数据已写入：');
  console.log(`  管理员  admin@example.com / Admin123456`);
  console.log(`  普通用户 user@example.com  / User123456`);
  console.log(`  会议室  ${rooms.map((room) => room.name).join('、')}`);
};

try {
  await main();
} finally {
  await db.close();
}
