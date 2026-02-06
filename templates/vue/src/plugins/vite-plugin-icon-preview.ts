import fs from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import type { ViteDevServer } from 'vite';

// 默认配置
const defaults = {
  entry: '/icons',
  iconDirs: resolve(process.cwd(), './src/assets/icons'),
};

interface Options {
  entry?: string;
  iconDirs?: string;
}

/**
 * 读取图标文件名列表
 * @param iconDirs 图标目录路径
 * @returns 图标文件名数组
 */
function getIconFileNames(iconDirs: string): string[] {
  let fileNames: string[] = [];
  try {
    const stat = fs.statSync(iconDirs);
    if (stat.isDirectory()) {
      fileNames = fs
        .readdirSync(iconDirs, { encoding: 'utf-8' })
        .filter((item) => item.endsWith('.svg'));
    }
  } catch (e) {
    console.error(e);
  }
  return fileNames;
}

/**
 * 生成图标列表HTML内容
 * @param fileNames 图标文件名数组
 * @param iconDirs 图标目录路径
 * @returns HTML字符串
 */
function generateIconListHTML(fileNames: string[], iconDirs: string): string {
  return fileNames
    .map((item) => {
      const iconName = item.replaceAll('.svg', '');
      return `<div data-icon="${iconName}" class="icon-item">
        <div class="icon-container">${fs.readFileSync(resolve(iconDirs, item), 'utf-8')}</div>
        <span class="icon-name">${iconName}</span>
      </div>`;
    })
    .join('');
}

/**
 * 生成样式CSS
 * @returns CSS样式字符串
 */
function generateStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      padding: 20px;
    }
    .header { text-align: center; margin-bottom: 32px; }
    .title { color: #1f2937; font-size: 2rem; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 1rem; font-weight: 400; }
    .header { text-align: center; margin-bottom: 32px; }
    .title { color: #1f2937; font-size: 2rem; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 1rem; font-weight: 400; }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0;
    }
    .search-container { margin-bottom: 24px; position: relative; }
    .search-input { width: 100%; padding: 12px 16px 12px 40px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; outline: none; background: white; }
    .search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
    .stats { margin-bottom: 24px; padding: 8px 0; text-align: center; }
    .stats-text { color: #6b7280; font-size: 14px; font-weight: 500; }
    .search-input { width: 100%; padding: 12px 16px 12px 40px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; outline: none; background: white; }
    .search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
    .stats { margin-bottom: 24px; padding: 8px 0; text-align: center; }
    .stats-text { color: #6b7280; font-size: 14px; font-weight: 500; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; }
    .icon-item { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; height: 100px; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; transition: all 0.2s ease; }
    .icon-item:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    .icon-item:hover .icon-container { color: #3b82f6; transform: scale(1.05); }
    .icon-container { color: #6b7280; transition: all 0.2s ease; margin-bottom: 8px; }
    .icon-name { font-size: 12px; color: #374151; text-align: center; font-weight: 500; word-break: break-all; }
    svg { width: 24px; height: 24px; }
    .toast { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transform: translateX(100%); transition: transform 0.3s ease; z-index: 1000; font-weight: 500; }
    .toast.show { transform: translateX(0); }
    .hidden { display: none !important; }
    .empty-state { text-align: center; padding: 48px 20px; color: #9ca3af; }
    .empty-text { font-size: 18px; font-weight: 600; color: #6b7280; margin-bottom: 8px; }
    @media (max-width: 768px) { body { padding: 16px; } .grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; } .icon-item { height: 80px; padding: 12px; } .title { font-size: 1.5rem; } }
  `;
}

/**
 * 生成JavaScript代码
 * @returns JavaScript代码字符串
 */
function generateScript(): string {
  return `
    function showToast(message) {
      const toast = document.createElement('div');
      toast.className = 'toast show';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 2000);
    }

    function copyToClipboard(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast(text + ' 复制成功!'));
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast(text + ' 复制成功!');
      }
    }

    function updateStats() {
      const visibleItems = document.querySelectorAll('[data-icon]:not(.hidden)');
      const emptyState = document.querySelector('.empty-state');
      const grid = document.querySelector('.grid');

      if (visibleItems.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (grid) grid.classList.add('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
        if (grid) grid.classList.remove('hidden');
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const searchInput = document.getElementById('searchInput');
      const iconItems = document.querySelectorAll('[data-icon]');

      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        iconItems.forEach(item => {
          const iconName = item.getAttribute('data-icon').toLowerCase();
          item.classList.toggle('hidden', !iconName.includes(searchTerm));
        });
        updateStats();
      });

      iconItems.forEach(item => {
        item.addEventListener('click', () => {
          copyToClipboard(item.getAttribute('data-icon'));
        });
      });

      updateStats();
    });
  `;
}

/**
 * 生成完整的HTML页面
 * @param contents 图标列表HTML内容
 * @returns 完整的HTML页面字符串
 */
function generateHTML(contents: string): string {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>图标预览 - Icon Preview</title>
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style>${generateStyles()}</style>
    </head>
    <body>
      <div class="container">
        <div class="search-container">
          <div class="search-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            id="searchInput"
            class="search-input"
            placeholder="搜索图标名称..."
            autocomplete="off"
          />
        </div>

        <div class="grid">${contents}</div>

        <div class="empty-state hidden">
          <p class="empty-text">没有找到匹配的图标</p>
        </div>
      </div>

      <script>${generateScript()}</script>
    </body>
    </html>
  `;
}

/**
 * 处理图标预览请求的中间件
 * @param entry 入口路径
 * @param iconDirs 图标目录路径
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 */
function handleIconPreview(
  entry: string,
  iconDirs: string,
  req: any,
  res: any,
  next: () => void,
): void {
  if (!req.url?.startsWith(entry)) return next();

  const fileNames = getIconFileNames(iconDirs);
  const contents = generateIconListHTML(fileNames, iconDirs);

  res.setHeader('Content-Type', 'text/html');
  res.end(generateHTML(contents));
}

/**
 * 生成图标预览插件
 * @param options 配置选项
 * @returns 插件对象
 */
export default function (options: Options) {
  const config = { ...defaults, ...options };
  const { entry, iconDirs } = config;

  return {
    name: 'icon-preview',
    /**
     * 配置开发服务器
     * @param server Vite 开发服务器实例
     */
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        handleIconPreview(entry, iconDirs, req, res, next);
      });
    },
  };
}
