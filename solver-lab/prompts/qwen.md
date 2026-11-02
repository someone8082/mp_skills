# Qwen / 千问平台补充提示词

与[通用提示词](web-common.md)或[复杂题图解提示词](web-advanced.md)、题目一起发送；有适用模板时再附HTML：

```text
请区分国际Qwen Chat与国内千问，以当前页面实际出现的Artifacts/代码/网页预览入口为准。固定模板优先原样预览附件或只替换lesson-data，后续同题型只给JSON。复杂题按已提供的图解要求独立推导并生成SVG图解HTML，提供缩放、拖动、复位及步骤对应，不伪造固定模板JSON。可可靠编辑现有文件时后续只更新数据或对应片段。

不要把国际Qwen Chat的Artifacts文档当成国内千问账号的功能保证，也不要从模型API推断前端执行JavaScript。未执行时如实说明；固定模板保留JSON，复杂题保留题解和完整文件。按实际提供的播放/导入或大图缩放/拖动分别验收；有时间或参数演示再测暂停、拖动、事件跳转及图与读数同步，不把静态图说成动画，也不把生成文件说成预览已通过。
```

Qwen 官方历史公告提及国际 Qwen Chat 的 Artifacts；本项目未做国际 Qwen Chat 或国内千问的登录账号实测。详见 [兼容性依据](../docs/browser-compatibility.md)。
