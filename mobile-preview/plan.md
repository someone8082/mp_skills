# 手机图解预览器 Implementation Plan

> **For agentic workers:** 使用executing-plans在当前会话逐项执行；本次不委派代理。此前交互和功能方案已获用户同意。

**Goal:** 学生通过固定网站粘贴HTML或LessonSpec JSON，在手机上运行图解。

**Architecture:** 独立buildless项目；输入/缓存逻辑与DOM控制分开；复用现有数值编译器及未改动的三个模板；iframe隔离HTML。Sites负责独立源码与部署，主应用不变。

**Tech Stack:** HTML/CSS/ESM、Node内置测试；现有jsdom用于DOM检查，真实浏览器通过cua_repl检查。

## 文件

- `mobile-preview/src/core.mjs`：输入识别、LessonSpec编译、模板JSON替换、沙箱文档和历史数据。
- `mobile-preview/src/app.mjs`：输入、异步载入、取消旧运行、状态与历史列表。
- `mobile-preview/src/index.html`、`styles.css`：手机编辑与全页预览。
- `mobile-preview/scripts/build.mjs`：白名单复制到dist，附runtime/和templates/。
- `mobile-preview/tests/core.test.mjs`、`app.test.mjs`：真实边界与DOM交互。
- `mobile-preview/README.md`：运行、托管、限制与验收；`.openai/hosting.json`保存Sites ID。

## 顺序

- [ ] 输入与编译测试：完整HTML/代码围栏、缺少题型、非法JSON、错误单位/claim、script关闭符。先执行`node --test mobile-preview/tests/core.test.mjs`并确认缺模块而失败；实现后复验。
- [ ] 沙箱与缓存测试：不得开放allow-same-origin；CSP位于所有用户代码之前；历史最多3条、去重、破损缓存与配额失败不影响当前内容。
- [ ] 页面实现：编辑和预览互斥，44px控件、safe-area、100dvh，按钮显示加载状态；任意失败卸载旧frame；异步竞态只接受最后一轮运行；返回编辑与停止卸载脚本。
- [ ] 构建：只复制src、kit/shared/lesson所需运行模块和3份HTML/JSON示例，检查本机无Node启动依赖。
- [ ] DOM验证：运行→返回→修改→重跑→停止；出错后iframe为空；历史刷新恢复，使用实际HTML和JSON而非镜像断言。
- [ ] 浏览器验证：360/390/1100px、HTML交互及JSON模板内核，阻止父页读取与远程资源；保存截图与实际结果。发布前运行必要测试并读出结果。
- [ ] Sites独立仓库提交、打包、发布与远端状态核对；不混入主项目脏改动。若服务权限阻塞则交付可运行源码与本地入口并明确具体原因。
- [ ] 补充网页prompt手机入口说明及开发索引，保留部署URL/权限/设备未测范围；不擅自推送mp_skills。
