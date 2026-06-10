# Day 26：定时任务与事件系统

## 今日概览

图书管理系统需要一些定时任务（如每天统计借阅量、清理过期记录）和事件通知（如借书成功后通知管理员）。今天学习 @nestjs/schedule 和 @nestjs/event-emitter。

## 学习目标

- 掌握 @Cron/@Interval/@Timeout 装饰器
- 使用 SchedulerRegistry 动态管理定时任务
- 掌握 EventEmitter2 事件驱动解耦模块
- 实战：定时统计 + 事件通知

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-Cron定时任务详解.md](01-Cron定时任务详解.md) | @Cron 定时任务详解 |
| [02-SchedulerRegistry动态管理.md](02-SchedulerRegistry动态管理.md) | SchedulerRegistry 动态管理 |
| [03-EventEmitter2事件解耦.md](03-EventEmitter2事件解耦.md) | EventEmitter2 事件解耦 |
| [04-图书管理系统实战场景.md](04-图书管理系统实战场景.md) | 图书管理系统实战场景 |
