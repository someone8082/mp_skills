# Qwen / 千问平台补充提示词

与 [通用提示词](web-common.md)、对应 HTML 附件、题目一起发送：

```text
请先区分我正在使用的是国际 Qwen Chat 还是国内千问，并以当前页面实际出现的 Artifacts/代码/网页预览入口为准。若能执行附件模板，优先原样预览；若能可靠编辑文件，仅替换 lesson-data JSON 并返回完整 HTML。后续同题型只给 JSON，我在预览内导入。

不要把国际 Qwen Chat 的 Artifacts 文档当成国内千问账号的功能保证，也不要用模型 API 的代码能力推断聊天前端会执行 JavaScript。当前没有执行预览时如实说明，保留 JSON；不能删除内核或把动画换成静态图后声称验收通过。
```

Qwen 官方历史公告提及国际 Qwen Chat 的 Artifacts；本项目未做国际 Qwen Chat 或国内千问的登录账号实测。详见 [兼容性依据](../docs/browser-compatibility.md)。
