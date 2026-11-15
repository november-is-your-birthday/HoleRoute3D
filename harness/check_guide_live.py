# -*- coding: utf-8 -*-
"""通过本机 CDP 验收新手教程；需先以 --remote-debugging-port=9350 启动独立实例。"""
import base64
import json
import os
from pathlib import Path

import requests
import websocket

os.environ["NO_PROXY"] = "127.0.0.1,localhost"
OUT = Path(os.environ.get("TEMP", "/tmp"))
PORT = int(os.environ.get("CDP_PORT", "9350"))
pages = requests.get("http://127.0.0.1:%d/json" % PORT, timeout=10).json()
page = next(p for p in pages if p.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=20, suppress_origin=True)
seq = 0


def call(method, params=None):
    global seq
    seq += 1
    ident = seq
    ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") != ident:
            continue
        if "error" in msg:
            raise RuntimeError(msg["error"])
        return msg.get("result", {})


def evaluate(expression):
    result = call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
        "userGesture": True,
    })
    if result.get("exceptionDetails"):
        raise RuntimeError(json.dumps(result["exceptionDetails"], ensure_ascii=False))
    return result.get("result", {}).get("value")


def settle():
    evaluate("new Promise(resolve=>setTimeout(()=>resolve(true),80))")


def metrics(width, height):
    call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False,
    })
    settle()


def shot(name):
    if os.environ.get("SKIP_SHOTS") == "1":
        return "skipped"
    data = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False, "fromSurface": False})["data"]
    path = OUT / name
    path.write_bytes(base64.b64decode(data))
    return str(path)


call("Page.enable")
call("Runtime.enable")
call("Page.bringToFront")
metrics(1440, 900)
evaluate("document.querySelector('.lc-guide-button').click()")
settle()
report = {"light": evaluate("""(()=>{
 const d=document.querySelector('.lc-guide-dialog').getBoundingClientRect();
 const b=document.querySelector('.lc-guide-button').getBoundingClientRect();
 const c=document.querySelector('.lc-guide-content');
 return {viewport:[innerWidth,innerHeight],dialog:{x:d.x,y:d.y,width:d.width,height:d.height},
 button:{x:b.x,y:b.y,width:b.width,height:b.height},chapters:document.querySelectorAll('.lc-guide-nav-item').length,
 content:{client:c.clientHeight,scroll:c.scrollHeight},title:document.querySelector('#lc-guide-title').textContent,
 overflow:document.documentElement.scrollWidth>innerWidth};
})()""")}
report["light_shot"] = shot("pr3d-v350-guide-light.png")

# 直达最后一章，再切深色主题，检查快捷键网格与深色对比。
evaluate("document.querySelectorAll('.lc-guide-nav-item')[6].click()")
evaluate("document.querySelector('button[title=\"切换深色/浅色模式\"]').click()")
settle()
report["dark"] = evaluate("""(()=>({
 theme:document.documentElement.dataset.theme,
 chapter:document.querySelector('.lc-guide-content-head h3').textContent,
 keys:document.querySelectorAll('.lc-guide-key').length,
 text:getComputedStyle(document.querySelector('.lc-guide-dialog')).color,
 background:getComputedStyle(document.querySelector('.lc-guide-dialog')).backgroundColor
}))()""")
report["dark_shot"] = shot("pr3d-v350-guide-dark.png")

# 窄窗口：目录转为横向，正文保持单列，底部操作仍需完整可见。
metrics(720, 720)
evaluate("document.querySelectorAll('.lc-guide-nav-item')[0].click()")
settle()
report["narrow"] = evaluate("""(()=>{
 const d=document.querySelector('.lc-guide-dialog').getBoundingClientRect();
 const f=document.querySelector('.lc-guide-footer').getBoundingClientRect();
 const body=getComputedStyle(document.querySelector('.lc-guide-body'));
 return {dialog:{x:d.x,y:d.y,width:d.width,height:d.height},footerBottom:f.bottom,
 columns:body.gridTemplateColumns,overflow:document.documentElement.scrollWidth>innerWidth};
})()""")
report["narrow_shot"] = shot("pr3d-v350-guide-narrow.png")

# 回主界面：Esc 关闭，恢复浅色与大窗口，检查顶部所有操作仍在视口内。
evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
metrics(1440, 900)
evaluate("document.querySelector('button[title=\"切换深色/浅色模式\"]').click()")
settle()
report["main"] = evaluate("""(()=>{
 const b=document.querySelector('.lc-guide-button').getBoundingClientRect();
 const a=document.querySelector('.header-actions').getBoundingClientRect();
 const tb=document.querySelector('.toolbar-scroll-inner');
 return {guideOpen:!!document.querySelector('.lc-guide-dialog'),guideButton:{x:b.x,right:b.right,width:b.width},
 actionsRight:a.right,viewport:innerWidth,toolbar:tb?{client:tb.clientWidth,scroll:tb.scrollWidth}:null,
 theme:document.documentElement.dataset.theme};
})()""")
report["main_shot"] = shot("pr3d-v350-main-light.png")

if os.environ.get("CHECK_PROJECT") == "1":
    evaluate("""(()=>{const s=document.querySelector('.project-action-select');s.value='new';s.dispatchEvent(new Event('change',{bubbles:true}));})()""")
    settle()
    report["new_project_dialog"] = evaluate("Array.from(document.querySelectorAll('.dialog button')).map(b=>b.textContent)")
    evaluate("""(()=>{const b=Array.from(document.querySelectorAll('.dialog button')).find(x=>x.textContent.includes('创建'));if(b)b.click();})()""")
    settle()
    report["project_main"] = evaluate("""(()=>{
     const tb=document.querySelector('.toolbar-scroll-inner');
     const b=document.querySelector('.lc-guide-button').getBoundingClientRect();
     const a=document.querySelector('.header-actions').getBoundingClientRect();
     return {project:!!window.__lcProject,toolbar:tb?{client:tb.clientWidth,scroll:tb.scrollWidth}:null,
     guideButton:{x:b.x,right:b.right},actionsRight:a.right,viewport:innerWidth,
     overflow:document.documentElement.scrollWidth>innerWidth};
    })()""")
    evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'F1',bubbles:true}))")
    settle()
    report["project_f1"] = evaluate("!!document.querySelector('.lc-guide-dialog')")
    evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")

print(json.dumps(report, ensure_ascii=False, indent=2))
ws.close()
