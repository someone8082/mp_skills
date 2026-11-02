"""Embed a local figure and a dependency-free viewer in a standalone HTML report."""
from pathlib import Path
import base64
import html
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent

def data_url(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(Path(path).read_bytes()).decode('ascii')

def figure_markup(png_path, svg_path, title):
    thumbnail = data_url(png_path, 'image/png')
    source, kind, width, height = thumbnail, 'bitmap', 0, 0
    if svg_path and Path(svg_path).is_file():
        svg = ET.fromstring(Path(svg_path).read_bytes())
        view_box = svg.attrib.get('viewBox', '').split()
        if len(view_box) == 4:
            width, height = float(view_box[2]), float(view_box[3])
        if width > 0 and height > 0:
            source, kind = data_url(svg_path, 'image/svg+xml'), 'vector'
    label = html.escape(title, quote=True)
    return (f'<figure class="fv-figure" data-fv-src="{source}" data-fv-kind="{kind}" '
            f'data-fv-width="{width}" data-fv-height="{height}" data-fv-title="{label}">'
            f'<button type="button" class="fv-picture" data-fv-open aria-haspopup="dialog" '
            f'aria-controls="fv-dialog" aria-label="放大查看：{label}">'
            f'<img alt="{label}：带点名、方向和阶段标注的图解" src="{thumbnail}"></button>'
            f'<figcaption><span>{label}</span><button type="button" data-fv-open '
            f'aria-haspopup="dialog" aria-controls="fv-dialog">放大查看 ↗</button></figcaption></figure>')

def viewer_assets():
    style = (HERE / 'style.css').read_text(encoding='utf-8')
    runtime = (HERE / 'runtime.js').read_text(encoding='utf-8')
    return f'''<style data-figure-viewer>{style}</style>
<dialog id="fv-dialog" class="fv-dialog" aria-labelledby="fv-title" aria-describedby="fv-help">
  <div class="fv-shell">
    <div class="fv-heading"><div><span class="fv-eyebrow">图解查看</span><h2 id="fv-title"></h2></div>
      <button type="button" data-fv-action="close" aria-label="关闭图解查看">关闭 ×</button></div>
    <div class="fv-toolbar" role="group" aria-label="图解视图控制">
      <button type="button" data-fv-action="out" aria-label="缩小">−</button>
      <output data-fv-scale aria-live="polite">100%</output>
      <button type="button" data-fv-action="in" aria-label="放大">＋</button>
      <button type="button" data-fv-action="fit">适应窗口</button>
      <button type="button" data-fv-action="reset">恢复视图</button>
      <span data-fv-quality></span>
    </div>
    <p id="fv-help">滚轮缩放 · 按住拖动 · 手机双指缩放 · 键盘 + / − 缩放，方向键平移，0 复位，Esc 关闭</p>
    <div class="fv-viewport" data-fv-viewport tabindex="0" role="region" aria-label="可缩放和拖动的图解">
      <img class="fv-image" data-fv-image alt="" draggable="false">
    </div>
  </div>
</dialog><script data-figure-viewer>{runtime}</script>'''
