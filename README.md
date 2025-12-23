# PromptSnap - Gemini 效率助手

PromptSnap 是一个 Chrome 浏览器扩展，专为 Google Gemini (`gemini.google.com`) 设计。它通过侧边栏提供“预设 Prompt 一键填入”功能，极大提升与 AI 交互的效率。

## ✨ 主要功能

*   **悬浮球唤起**：在页面右侧悬浮，支持垂直拖拽，不遮挡界面。
*   **侧边栏管理**：轻量级侧边栏，支持查看、新增、编辑、删除 Prompt。
*   **一键填入**：点击列表项，自动将 Prompt 填入 Gemini 输入框（支持多行）。
*   **数据同步**：数据保存在本地浏览器 (`chrome.storage.local`)，隐私安全。
*   **预置数据**：首次安装自动内置 3 条常用 Prompt。

## 🚀 如何安装 (开发者模式)

1.  下载或 Clone 本项目到本地。
2.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
3.  开启右上角的 **"开发者模式" (Developer mode)** 开关。
4.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
5.  选择本项目的根目录 (`/path/to/PromptSnap`)。
6.  打开 [Gemini](https://gemini.google.com/)，刷新页面，即可看到右侧的悬浮球。

## 🛠️ 开发说明

*   `manifest.json`: 配置文件 (Manifest V3)。
*   `scripts/content.js`: 核心逻辑 (UI 注入、事件处理、DOM 操作)。
*   `styles/content.css`: 样式文件。

## 📝 版本历史

*   **v0.1.0 (MVP)**: 基础功能上线，支持 CRUD 和一键填入。