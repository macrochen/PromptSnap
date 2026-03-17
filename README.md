# PromptSnap - AI 效率助手

PromptSnap 是一个 Chrome 浏览器扩展，面向各类 AI Web Chat 网站。它通过弹窗面板提供“预设 Prompt 一键填入”功能，帮助用户在不同 AI 对话页面中快速复用常用指令，提升交互效率。

## ✨ 主要功能

*   **广泛兼容**：适用于多数 AI Web Chat 页面，支持在当前页面或指定站点执行 Prompt。
*   **Prompt 管理**：支持查看、新增、编辑、删除、分类管理 Prompt。
*   **变量模板**：支持 `{{变量名}}`、`{{变量名:默认值}}` 等动态占位符。
*   **一键填入**：点击列表项，自动将 Prompt 填入当前页面的输入框（支持多行）。
*   **跨站执行**：可配置常用 AI 网站，并在新标签页打开目标站点后自动填入。
*   **复制与备份**：支持复制 Prompt、导出 JSON 备份、导入恢复数据。
*   **本地存储**：数据保存在本地浏览器 (`chrome.storage.local`)，隐私安全。

## 🚀 如何安装 (开发者模式)

1.  下载或 Clone 本项目到本地。
2.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
3.  开启右上角的 **"开发者模式" (Developer mode)** 开关。
4.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
5.  选择本项目的根目录 (`/path/to/PromptSnap`)。
6.  打开任意 AI 对话网站并刷新页面，点击扩展图标即可使用 PromptSnap。

## ☁️ Google Drive 远程备份配置

PromptSnap 支持将本地 Prompt 数据自动备份到 Google Drive。当前实现使用 Chrome 扩展内置的 Google OAuth 流程和 Drive 的应用私有数据目录，因此首次使用前需要先创建一个 `Google OAuth Client ID`，并写入扩展的 `manifest.json`。

### 第一步：启用 Google Drive API

1.  打开 Google Cloud Console，对应入口可从 Google Workspace 官方文档进入：[Create access credentials](https://developers.google.com/workspace/guides/create-credentials)。
2.  创建或选择一个 Google Cloud 项目。
3.  在项目中启用 **Google Drive API**。

### 第二步：配置 OAuth 同意屏幕

1.  进入 Google Cloud Console 的 `Google Auth platform`。
2.  配置 OAuth consent screen。
3.  如果当前只给自己使用，通常选择 `External` 即可。
4.  将你自己的 Google 账号加入测试用户。

### 第三步：创建 Chrome Extension 类型的 OAuth Client ID

1.  在 Google Cloud Console 中进入 `Google Auth platform > Clients`。
2.  点击 `Create Client`。
3.  选择 `Application type = Chrome Extension`。
4.  填写名称，例如 `PromptSnap Dev`。
5.  在 `Item ID` 中填写扩展 ID。
6.  创建后复制生成的 `Client ID`。

官方参考：
- [Create access credentials](https://developers.google.com/workspace/guides/create-credentials)
- [OAuth 2.0 for Chrome Extensions](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)

### 第四步：获取扩展 ID

1.  打开 `chrome://extensions/`
2.  开启右上角的开发者模式
3.  找到 PromptSnap
4.  复制显示的扩展 ID

### 第五步：写入 `manifest.json`

打开 [manifest.json](/Users/shi/workspace/PromptSnap/manifest.json)，将 `oauth2.client_id` 改成你刚刚创建的 Client ID：

```json
"oauth2": {
  "client_id": "你的 Google OAuth Client ID",
  "scopes": [
    "https://www.googleapis.com/auth/drive.appdata"
  ]
}
```

修改后重新加载扩展。

### 第六步：在 PromptSnap 中授权

1.  打开 PromptSnap 弹窗
2.  进入设置页
3.  点击 `连接 Drive`
4.  在弹出的 Google 页面中选择账号并授权

授权成功后，PromptSnap 就可以：
- 手动执行“立即备份”
- 从云端恢复本地数据
- 在保存 Prompt、导入 Prompt、增删站点后自动尝试备份

### 注意事项

*   开发模式下，扩展 ID 发生变化会导致之前创建的 OAuth Client ID 失效，因为 Chrome Extension 类型的凭据与 `Item ID` 绑定。
*   如果你重新安装了扩展、切换了打包方式，或者扩展 ID 改变，需要回到 Google Cloud Console 重新创建或更新对应的 OAuth Client ID。
*   修改 `manifest.json` 后，需要回到 `chrome://extensions/` 重新加载扩展，新的 OAuth 配置才会生效。
*   当前远程备份使用的是 Google Drive 的应用私有数据能力，适合作为个人同步和备份方案。Google 官方关于应用私有数据目录的说明见：[Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata)。

## 🌐 适用场景

PromptSnap 当前通过通用输入框探测策略工作，适合大多数 AI Web Chat 页面，例如 ChatGPT、Claude、Gemini、AI Studio、DeepSeek 等。若页面存在可聚焦的 `textarea`、`input` 或 `contenteditable` 输入区域，插件通常可以直接识别并填入。

如果某个站点识别效果不理想，优先在目标输入框中先点击聚焦，再执行填入。当前实现已经对常见聊天输入区域做了通用兼容，不再依赖站点白名单配置。


## 🛠️ 开发说明

*   `manifest.json`: 扩展配置文件 (Manifest V3)。
*   `popup/popup.js`: Prompt 列表、变量输入、站点配置、导入导出等主交互逻辑。
*   `scripts/background.js`: 新标签页打开与自动填入的异步调度逻辑。
*   `scripts/content.js`: 页面内输入框探测与文本注入逻辑。
*   `editor.js`: Prompt 新增与编辑逻辑。

## 📝 版本历史

*   **v0.1.0 (MVP)**: 基础功能上线，支持 CRUD 和一键填入。
