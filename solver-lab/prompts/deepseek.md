# DeepSeek 平台补充提示词

与 [通用提示词](web-common.md)、对应 HTML 附件、题目一起发送：

```text
请优先使用当前 DeepSeek 聊天页面实际提供的 HTML/代码运行或预览入口。若可执行附件模板，请原样打开，或只替换 lesson-data JSON 后返回完整 HTML。若目前只能输出文本，请仅给 LessonSpec JSON，说明需在原模板的输入框载入，保留条件不足与待审查提示。

先以实际点击播放、拖动时间轴和导入新 JSON 的结果判断是否运行；只有代码块、静态图或“运行”字样不能证明完整脚本可用。请不要引用 DeepSeek 开发者工具、API 或 Harness 的能力来保证消费端聊天网页的能力。
```

DeepSeek 消费端聊天的完整 JavaScript 预览目前未验证；“未验证”不等于“不支持”。详见 [兼容性记录](../docs/browser-compatibility.md)。
