/**
 * Prisma 8 客户端的注入 token。
 * 使用 Symbol 避免与其它字符串 token 冲突。
 */
export const PRISMA = Symbol('PRISMA');
