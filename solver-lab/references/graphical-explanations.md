# 图解优先的交付

## 图要承担解题任务

- 保留原题点名、正方向、坐标轴与单位；辅助点和线出现时说明为什么需要它。
- 几何题围绕构造或约束逐步显示关系；物理题区分受力、速度、相对运动和阶段。箭头方向与选定的符号约定一致。
- 优先让图和相应推导紧邻，点步骤时高亮对应点、线或阶段。暂时只有静态图时如实标注，不称已经演示了构造过程。
- 轨迹、读数、图例和结论应取自同一组参数/模型；归一化示例明确标注，不能把图示参数冒充题目数据。
- 三维问题可用三维视图或互相对应的投影；投影关系应说明。不能为了画图方便删掉空间自由度。

## 四种交互分别描述

图像缩放/平移用于看细节；构造步进展示几何关系；时间播放展示运动过程；改变参数需要重算模型与约束。提供了前一种，不代表已经支持其余三种。固定LessonSpec现有相机拖动/时间轴也不能作为一般图解缩放的证据。

## 已有图的离线查看器

包内`assets/figure-viewer/`提供已实现的SVG/PNG查看器，支持放大、缩小、拖动、复位、键盘和双指手势。它适用于自定义图解报告，不会自动注入`agent.mjs --html`的三个固定模板，也不增加CLI task。

生成阶段可选使用Python 3标准库；基础求解CLI仍只需要Node.js。已生成的单文件HTML无需Python、Node或网络。示例（SKILL_ROOT须替换为实际安装目录）：

```python
from pathlib import Path
import sys
skill_root = Path('SKILL_ROOT')
sys.path.insert(0, str(skill_root / 'assets/figure-viewer'))
from embed import figure_markup, viewer_assets

# title对应题目；PNG用于正文预览，SVG用于清晰放大。
graphic = figure_markup(Path('plot.png'), Path('plot.svg'), '带点名的图解')
page = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body><h1>解题图解</h1>' + graphic + viewer_assets() + '</body></html>')
Path('lesson.html').write_text(page, encoding='utf-8')
```

多个图使用多次`figure_markup`，每页只在图之后添加一次`viewer_assets()`。无SVG可传`None`，界面说明位图清晰度限制。宿主需要允许内嵌JavaScript；缺少Python时可直接复用包内CSS/JS的同样HTML结构，或交付SVG并说明尚未接入交互，不声称执行了嵌入器。

## 验收边界

检查所有图能打开/关闭、缩放、拖动与复位，关闭后恢复滚动/焦点；检查图片不被完全拖走、窗口变窄可找回整图、SVG加载失败有明确退化提示。正文滚动不应被查看器截获。

生成文件、DOM事件测试、真实浏览器布局、手机触控和各平台账号预览分别记录。没有实测的部分保留未测；模型口头自检不是运行证据。不要为了适配预览沙箱删掉数学条件或校验。
