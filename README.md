# PromptSnap - AI 效率助手

PromptSnap 是一个 Chrome 浏览器扩展，专为 Google Gemini (`gemini.google.com`) 和 Google AI Studio (`aistudio.google.com`) 设计。它通过侧边栏提供“预设 Prompt 一键填入”功能，极大提升与 AI 交互的效率。

## ✨ 主要功能

*   **多平台支持**：同时支持 Gemini 和 AI Studio。
*   **悬浮球唤起**：在页面右侧悬浮，支持垂直拖拽，不遮挡界面。
*   **侧边栏管理**：轻量级侧边栏，支持查看、新增、编辑、删除 Prompt。
*   **一键填入**：点击列表项，自动将 Prompt 填入当前页面的输入框（支持多行）。
*   **数据同步**：数据保存在本地浏览器 (`chrome.storage.local`)，隐私安全。
*   **预置数据**：首次安装自动内置 3 条常用 Prompt。

## 🚀 如何安装 (开发者模式)

1.  下载或 Clone 本项目到本地。
2.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
3.  开启右上角的 **"开发者模式" (Developer mode)** 开关。
4.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
5.  选择本项目的根目录 (`/path/to/PromptSnap`)。
6.  打开 [Gemini](https://gemini.google.com/) 或 [AI Studio](https://aistudio.google.com/)，刷新页面，即可看到右侧的悬浮球。

## 🔌 如何支持其他网站 (扩展指南)

PromptSnap 内置了**智能探测引擎**，理论上支持大多数 AI 对话网站。如果您希望在其他网站（如 ChatGPT, Claude, DeepSeek）使用本插件，只需两步：

### 第一步：注册权限
打开 `manifest.json`，在 `host_permissions` 和 `content_scripts.matches` 中添加目标网站的 URL。

```json
"host_permissions": [
  "https://gemini.google.com/*",
  "https://chatgpt.com/*"  <-- 新增这行
],
"content_scripts": [
  {
    "matches": [
      "https://gemini.google.com/*",
      "https://chatgpt.com/*" <-- 新增这行
    ],
    ...
  }
]
```

### 第二步：配置选择器 (可选)
通常情况下，插件能自动找到页面上的输入框。如果自动识别失败，您可以在 `scripts/content.js` 顶部的 `SITE_CONFIG` 数组中添加精准匹配规则：

```javascript
const SITE_CONFIG = [
    // ... 现有配置
    {
        name: 'My New Site',
        domain: 'example.com',
        selector: '#custom-input-id' // 目标网站输入框的 CSS 选择器
    }
];
```

重新加载插件即可生效！


## 🛠️ 开发说明

*   `manifest.json`: 配置文件 (Manifest V3)。
*   `scripts/content.js`: 核心逻辑 (UI 注入、事件处理、DOM 操作)。
*   `styles/content.css`: 样式文件。

## 📝 版本历史

*   **v0.1.0 (MVP)**: 基础功能上线，支持 CRUD 和一键填入。