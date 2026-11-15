/* =================================================================
 * v3.5.0：新手教程 + 小范围人机工程学界面优化
 *
 * 教程完全在本地运行，不加载网络资源。入口常驻顶栏，未创建工程时也能打开。
 * 界面只调整视觉层级、点击区域、焦点与弹窗，不改变主面板的位置和操作流程。
 * ================================================================= */

var __lcGuideSections = [
  {
    id: "start",
    nav: "快速上手",
    title: "从零完成第一块洞洞板",
    intro: "按下面 5 步走即可。建议第一次先用简单电路熟悉流程，再处理正式工程。",
    blocks: [
      {
        type: "steps",
        title: "完整流程",
        items: [
          { title: "新建工程", text: "点右上角「工程 → 新建」，选择洞洞板或面包板，并设置实际孔数。板宽 W 是列数，板高 H 是行数。" },
          { title: "导入网表", text: "把网表拖到左侧导入区。嘉立创 EDA 专业版优先选 .enet，也支持 Protel / KiCad .net 和 Multisim 报告。" },
          { title: "生成并摆放元件", text: "导入后必须再点顶部「生成元件 G」，然后使用「自动放置 P」，或按住 Shift 拖动元件手动布局。" },
          { title: "自动布线并修线", text: "点「自动布线 A」生成初稿，再按 T 透视检查背面走锡；交叉处用跳线，未连通处可手工补线或继续布线。" },
          { title: "DRC 检查与备份", text: "点「DRC 检查 D」，先处理红色错误，再对照原理图复核。最后点右上角「导出工程 JSON」留档。" }
        ]
      },
      { type: "note", tone: "tip", title: "推荐路线", text: "新建工程 → 导入 .enet → 生成元件 → 自动放置 → 自动布线 → DRC → 导出工程 JSON。" },
      { type: "note", tone: "warn", title: "内测版提醒", text: "自动放置、自动布线和 DRC 只能辅助检查，不能替代原理图与实物核对。焊接前务必确认引脚、极性、电源和短路风险。" }
    ]
  },
  {
    id: "import",
    nav: "导入网表",
    title: "把原理图变成元件与网络",
    intro: "网表提供元件位号、引脚和连接关系。导入成功只代表数据已读入，元件还要通过「生成元件」进入 3D 场景。",
    blocks: [
      {
        type: "steps",
        title: "嘉立创 EDA 专业版（推荐）",
        items: [
          { title: "导出 .enet", text: "在原理图页面选择「文件 → 导出 → 网表」，网表类型选「嘉立创EDA(专业版)(.enet)」。" },
          { title: "拖入左侧导入区", text: "也可以点击导入区选择文件。导入后检查元件数、网络数与警告，确认没有漏元件。" },
          { title: "点「生成元件 G」", text: "这是独立步骤，不是导入失败。生成后再点「自动放置」，元件才会按布局出现在板上。" }
        ]
      },
      {
        type: "list",
        title: "其他支持的格式",
        items: [
          { title: "Protel2 / Protel 99SE（.net）", text: "嘉立创和立创 EDA 均可使用；通常只有脚号，三极管脚序需结合封装与数据手册复核。" },
          { title: "KiCad（.net）", text: "直接导入 KiCad 导出的网表，无需先转换。" },
          { title: "Multisim（.txt / .csv）", text: "从 Tools → Reports 分别导出 Wire List 与 Cross Reference，两份报告一起拖入；不支持 SPICE .cir。" }
        ]
      },
      { type: "note", tone: "tip", title: "为什么优先 .enet", text: "它能携带引脚功能名和标准封装名，例如 LED 的 C/A、芯片的 GND/OUT，能减少靠封装猜测脚序的情况。" },
      { type: "note", tone: "warn", title: "导入后有警告怎么办", text: "先阅读左侧导入结果。未知封装可能会临时按排针处理，请选中元件，在右侧属性面板核对脚数、脚距和跨距。" }
    ]
  },
  {
    id: "place",
    nav: "摆放与视角",
    title: "先摆好元件，再开始布线",
    intro: "布局会直接影响布线成功率。先安排连接器、芯片和大元件，再摆电阻、电容等小元件。",
    blocks: [
      {
        type: "steps",
        title: "摆放元件",
        items: [
          { title: "自动放置 P", text: "快速生成一版布局。元件较多时需要等待，可随时取消；自动结果通常仍需人工微调。" },
          { title: "移动与旋转", text: "按住 Shift 拖动已放置元件；R 旋转所选元件。先拔起再微调时，可用空格顺时针旋转。" },
          { title: "多选与组合移动", text: "Ctrl + 点击可追加或取消选择；多选后按住 Shift 拖动，可一起移动。普通点击空白处会取消多选。" },
          { title: "放置、拔起与删除", text: "M 放置、U 拔起、Shift+U 全部拔起、Delete 删除。拔起会保留走线，删除元件前请先确认。" }
        ]
      },
      {
        type: "list",
        title: "看清 3D 视图",
        items: [
          { title: "旋转 / 缩放 / 平移", text: "鼠标拖动旋转视角，滚轮缩放；需要时切换视角按钮，从元件面或焊接面检查。" },
          { title: "透视 T", text: "透过板体查看背面走锡与飞线。右上角眼睛按钮与快捷键 T 的作用相同。" },
          { title: "板尺寸", text: "顶部 W / H 输入新数值后按回车或点击别处生效；Esc 放弃修改，上下方向键可逐格调整。" }
        ]
      },
      { type: "note", tone: "tip", title: "布局建议", text: "让相关元件靠近、连接器靠板边、极性方向尽量统一，并给跳线和散热留出空间。不要只追求最小占用面积。" }
    ]
  },
  {
    id: "route",
    nav: "布线与检查",
    title: "自动布线打草稿，人工检查定结果",
    intro: "自动布线适合快速生成初稿。走不通时不要反复重跑，先调整布局或手工处理关键网络。",
    blocks: [
      {
        type: "steps",
        title: "推荐布线顺序",
        items: [
          { title: "自动布线 A", text: "生成整板初稿。若修改过布局，使用「继续布线」可保留已有走锡和跳线，只补尚未连通的部分。" },
          { title: "查看飞线", text: "打开「飞线层」并转到背面或按 T 透视。飞线表示网络尚未实际连通，不是需要直接焊接的导线。" },
          { title: "手工走锡 S", text: "依次点起点和终点。走锡只能沿同行或同列；黄色表示可落点，红色表示不合法，右键或 Esc 取消当前操作。" },
          { title: "跳线 J 与删线 E", text: "线路必须交叉时使用跳线；删线模式点击不需要的线段。修改后重新运行 DRC。" },
          { title: "DRC 检查 D", text: "红色错误优先处理；灰色悬空脚可能本就无需连接，但仍应对照原理图判断。C 可清除旧标记。" }
        ]
      },
      {
        type: "list",
        title: "焊接前的最低检查项",
        items: [
          { title: "连通性", text: "每个应连接的网络都已连通，没有遗漏飞线。" },
          { title: "短路", text: "不同网络没有共用不该共用的铜箔、孔位或跳线。" },
          { title: "可制造性", text: "走线不穿过元件实体，跳线有空间，焊盘和孔位与实际元件匹配。" }
        ]
      },
      { type: "note", tone: "warn", title: "最后仍要对照原理图", text: "DRC 通过不代表电路一定正确。封装、脚序、极性和原理图本身的问题，软件不一定能发现。" }
    ]
  },
  {
    id: "pins",
    nav: "引脚与极性",
    title: "看懂脚名、脚序和负极标记",
    intro: "模型上的标记用于辅助辨认，最终依据仍是实际器件封装和数据手册。",
    blocks: [
      {
        type: "list",
        title: "三极管 E / B / C",
        items: [
          { title: "白色字母", text: "来自网表引脚名或你手动选择的脚序，属于较明确的信息。" },
          { title: "暖黄色字母", text: "按常见封装排布暂时标注，属于推测值。不同厂家、不同型号可能不同，必须查数据手册。" },
          { title: "修改脚序", text: "选中三极管，在右侧属性面板选择 1/2/3 对应的 E/B/C 排布，并核对悬停提示中的脚名与网络。" }
        ]
      },
      {
        type: "list",
        title: "二极管与 LED",
        items: [
          { title: "黑色圆环", text: "模型上的黑色环用于标记负极 K / C；二极管黑环旁有细银边，便于在深色本体上辨认。" },
          { title: "引脚字母", text: "A 表示阳极，K 或 C 表示阴极。网表未提供名字时，软件会按常见约定暂定脚 1 为负极。" },
          { title: "实物复核", text: "发光二极管还要结合实物缺口、内部电极和数据手册判断，不要只依赖 3D 外观。" }
        ]
      },
      { type: "note", tone: "tip", title: "悬停查看网络", text: "把鼠标移到引脚上，可查看位号、脚号、脚名和所属网络，用来核对网表是否与原理图一致。" },
      { type: "note", tone: "warn", title: "黄色不等于错误", text: "黄色表示「尚未由网表或手动脚序确认」。确认器件实际排布后，在属性面板选择正确脚序即可。" }
    ]
  },
  {
    id: "save",
    nav: "保存与施工",
    title: "随时备份，按视图逐步施工",
    intro: "工程会自动保存在本机，但自动保存不能替代独立备份，尤其是在大改、清空或升级之前。",
    blocks: [
      {
        type: "steps",
        title: "保存与恢复",
        items: [
          { title: "导出工程 JSON", text: "点右上角导出按钮，保存包含板子、元件与走线的工程文件。重要节点建议另存一份并注明日期。" },
          { title: "打开已有工程", text: "选择「工程 → 打开」，读取之前导出的 JSON。打开前请先备份当前工程，避免被替换。" },
          { title: "撤销与重做", text: "Ctrl+Z 撤销，Ctrl+Shift+Z 重做。撤销步数可在右上角设置中调整。" }
        ]
      },
      {
        type: "steps",
        title: "建议的施工顺序",
        items: [
          { title: "核对板与孔位", text: "先确认实际洞洞板尺寸、孔距和板方向与软件一致。" },
          { title: "插元件并核对极性", text: "按位号逐一放置，重点核对芯片 1 脚、三极管脚序、二极管和电解电容极性。" },
          { title: "完成背面连接", text: "按走锡和跳线视图施工，每完成一个网络就用万用表蜂鸣档检查连通性。" },
          { title: "通电前检查", text: "先测电源与地是否短路，再检查供电极性和电压；首次通电建议限流。" }
        ]
      },
      { type: "note", tone: "warn", title: "清空操作要谨慎", text: "「清空工程」和「清空走线」影响范围不同。执行前阅读确认框，并先导出 JSON 备份。" }
    ]
  },
  {
    id: "keys",
    nav: "快捷键与排错",
    title: "常用快捷键与常见问题",
    intro: "快捷键可在右上角「设置」中修改。输入框内编辑文字时，不会执行画布快捷键。",
    blocks: [
      {
        type: "keys",
        title: "流程与编辑",
        items: [
          { key: "F1", text: "打开新手教程" },
          { key: "G", text: "生成元件" },
          { key: "P", text: "自动放置" },
          { key: "A", text: "自动布线" },
          { key: "D", text: "DRC 检查" },
          { key: "R", text: "旋转所选" },
          { key: "M / U", text: "放置 / 拔起" },
          { key: "Shift + U", text: "全部拔起" },
          { key: "Delete", text: "删除所选" },
          { key: "Ctrl + Z", text: "撤销" },
          { key: "Ctrl + Shift + Z", text: "重做" },
          { key: "F5", text: "刷新视图" }
        ]
      },
      {
        type: "keys",
        title: "视图与布线",
        items: [
          { key: "V", text: "选择模式" },
          { key: "T", text: "透视板体" },
          { key: "S", text: "走锡" },
          { key: "J", text: "跳线" },
          { key: "E", text: "删线" },
          { key: "C", text: "清除 DRC 标记" },
          { key: "Shift + 拖动", text: "移动元件" },
          { key: "Ctrl + 点击", text: "多选元件" },
          { key: "空格", text: "顺时针旋转" },
          { key: "Esc", text: "取消操作 / 关闭弹窗" }
        ]
      },
      {
        type: "list",
        title: "遇到问题先这样查",
        items: [
          { title: "导入后看不到元件", text: "先点「生成元件 G」，再点「自动放置 P」；同时检查左侧是否有解析警告。" },
          { title: "看不到刚布的线", text: "走锡通常在板背面。转到背面、按 T 透视，并确认飞线层和视角状态。" },
          { title: "自动布线布不通", text: "挪开拥挤元件、给关键网络留通道，再用手工走线或「继续布线」补完。" },
          { title: "按钮不可用", text: "先新建工程并生成元件；某些操作还要求元件已放置或已拔起。把鼠标停在按钮上可查看说明。" },
          { title: "界面显示异常", text: "先按 F5 刷新视图；仍异常时导出工程 JSON 备份，再重启软件。" }
        ]
      }
    ]
  }
];

function __lcGuideBlock(block, index) {
  if (!block) return null;
  if (block.type === "note") {
    return P.jsxs("aside", {
      className: "lc-guide-note " + (block.tone === "warn" ? "warn" : "tip"),
      children: [P.jsx("strong", { children: block.title }), P.jsx("p", { children: block.text })]
    }, index);
  }
  if (block.type === "keys") {
    return P.jsxs("section", {
      className: "lc-guide-block",
      children: [
        P.jsx("h3", { className: "lc-guide-block-title", children: block.title }),
        P.jsx("div", {
          className: "lc-guide-keys",
          children: block.items.map(function (item, i) {
            return P.jsxs("div", { className: "lc-guide-key", children: [P.jsx("kbd", { children: item.key }), P.jsx("span", { children: item.text })] }, i);
          })
        })
      ]
    }, index);
  }
  if (block.type === "steps") {
    return P.jsxs("section", {
      className: "lc-guide-block",
      children: [
        P.jsx("h3", { className: "lc-guide-block-title", children: block.title }),
        P.jsx("ol", {
          className: "lc-guide-steps",
          children: block.items.map(function (item, i) {
            return P.jsxs("li", {
              children: [
                P.jsx("span", { className: "lc-guide-step-number", children: i + 1 }),
                P.jsxs("div", { children: [P.jsx("h4", { children: item.title }), P.jsx("p", { children: item.text })] })
              ]
            }, i);
          })
        })
      ]
    }, index);
  }
  return P.jsxs("section", {
    className: "lc-guide-block",
    children: [
      P.jsx("h3", { className: "lc-guide-block-title", children: block.title }),
      P.jsx("ul", {
        className: "lc-guide-list",
        children: block.items.map(function (item, i) {
          return P.jsxs("li", { children: [P.jsx("strong", { children: item.title }), P.jsx("p", { children: item.text })] }, i);
        })
      })
    ]
  }, index);
}

function __lcGuideHost() {
  var openState = qt.useState(false);
  var open = openState[0];
  var setOpen = openState[1];
  var indexState = qt.useState(0);
  var index = indexState[0];
  var setIndex = indexState[1];
  var dialogRef = qt.useRef(null);
  var articleRef = qt.useRef(null);
  var restoreFocusRef = qt.useRef(null);
  var current = __lcGuideSections[index] || __lcGuideSections[0];

  qt.useEffect(function () {
    window.__lcOpenGuide = function (id) {
      var next = 0;
      if (typeof id === "string") {
        __lcGuideSections.forEach(function (sec, i) { if (sec.id === id) next = i; });
      }
      setIndex(next);
      setOpen(true);
    };
    function onGlobalKey(e) {
      if (e.key !== "F1") return;
      e.preventDefault();
      e.stopPropagation();
      window.__lcOpenGuide();
    }
    document.addEventListener("keydown", onGlobalKey, true);
    return function () {
      document.removeEventListener("keydown", onGlobalKey, true);
      if (window.__lcOpenGuide) delete window.__lcOpenGuide;
    };
  }, []);

  qt.useEffect(function () {
    if (!open) return;
    window.__lcGuideOpen = true;
    restoreFocusRef.current = document.activeElement;
    var timer = setTimeout(function () {
      if (dialogRef.current) dialogRef.current.focus();
    }, 0);
    function onDialogKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var tag = e.target && e.target.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault();
          setIndex(function (old) {
            return Math.max(0, Math.min(__lcGuideSections.length - 1, old + (e.key === "ArrowRight" ? 1 : -1)));
          });
        }
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      var nodes = dialogRef.current.querySelectorAll("button:not([disabled]),[href],[tabindex]:not([tabindex='-1'])");
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onDialogKey, true);
    return function () {
      clearTimeout(timer);
      document.removeEventListener("keydown", onDialogKey, true);
      window.__lcGuideOpen = false;
      var old = restoreFocusRef.current;
      if (old && old.focus) old.focus();
    };
  }, [open]);

  qt.useEffect(function () {
    if (articleRef.current) articleRef.current.scrollTop = 0;
  }, [index, open]);

  if (!open) return null;
  function go(delta) {
    setIndex(Math.max(0, Math.min(__lcGuideSections.length - 1, index + delta)));
  }
  return P.jsx("div", {
    className: "lc-guide-overlay",
    onClick: function (e) { if (e.target === e.currentTarget) setOpen(false); },
    children: P.jsxs("section", {
      className: "lc-guide-dialog",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "lc-guide-title",
      "aria-describedby": "lc-guide-subtitle",
      ref: dialogRef,
      tabIndex: -1,
      children: [
        P.jsxs("header", {
          className: "lc-guide-header",
          children: [
            P.jsx("div", { className: "lc-guide-brand-icon", "aria-hidden": "true", children: "?" }),
            P.jsxs("div", {
              className: "lc-guide-heading",
              children: [
                P.jsx("h2", { id: "lc-guide-title", children: "新手教程" }),
                P.jsx("p", { id: "lc-guide-subtitle", children: "从网表到可焊接的洞洞板 · 按章节查看，约 5 分钟" })
              ]
            }),
            P.jsx("button", {
              className: "lc-guide-close",
              type: "button",
              title: "关闭教程（Esc）",
              "aria-label": "关闭新手教程",
              onClick: function () { setOpen(false); },
              children: "×"
            })
          ]
        }),
        P.jsxs("div", {
          className: "lc-guide-body",
          children: [
            P.jsxs("nav", {
              className: "lc-guide-nav",
              "aria-label": "教程章节",
              children: [
                P.jsx("div", { className: "lc-guide-nav-caption", children: "学习目录" }),
                __lcGuideSections.map(function (sec, i) {
                  return P.jsxs("button", {
                    type: "button",
                    className: "lc-guide-nav-item" + (i === index ? " active" : ""),
                    "aria-current": i === index ? "page" : void 0,
                    onClick: function () { setIndex(i); },
                    children: [
                      P.jsx("span", { className: "lc-guide-nav-number", children: String(i + 1).padStart(2, "0") }),
                      P.jsx("span", { children: sec.nav })
                    ]
                  }, sec.id);
                }),
                P.jsx("div", { className: "lc-guide-nav-help", children: "F1 打开 · Esc 关闭\n← → 切换章节" })
              ]
            }),
            P.jsxs("main", {
              className: "lc-guide-content",
              ref: articleRef,
              "aria-live": "polite",
              children: [
                P.jsxs("div", {
                  className: "lc-guide-content-head",
                  children: [
                    P.jsx("span", { className: "lc-guide-eyebrow", children: "第 " + (index + 1) + " 章 / 共 " + __lcGuideSections.length + " 章" }),
                    P.jsx("h3", { children: current.title }),
                    P.jsx("p", { children: current.intro })
                  ]
                }),
                current.blocks.map(function (block, i) { return __lcGuideBlock(block, i); }),
                P.jsx("div", { className: "lc-guide-content-end", children: index === __lcGuideSections.length - 1 ? "教程看完了，先从「快速上手」的 5 步开始实践吧。" : "看完本章后，点下方「下一章」继续。" })
              ]
            }, current.id)
          ]
        }),
        P.jsxs("footer", {
          className: "lc-guide-footer",
          children: [
            P.jsxs("div", {
              className: "lc-guide-progress",
              "aria-label": "教程进度 " + (index + 1) + " / " + __lcGuideSections.length,
              children: [
                P.jsx("span", { children: index + 1 + " / " + __lcGuideSections.length }),
                P.jsx("div", { className: "lc-guide-progress-track", children: P.jsx("i", { style: { width: ((index + 1) / __lcGuideSections.length * 100) + "%" } }) })
              ]
            }),
            P.jsxs("div", {
              className: "lc-guide-footer-actions",
              children: [
                P.jsx("button", { className: "lc-guide-secondary", type: "button", disabled: index === 0, onClick: function () { go(-1); }, children: "上一章" }),
                P.jsx("button", {
                  className: "lc-guide-primary",
                  type: "button",
                  onClick: function () { index === __lcGuideSections.length - 1 ? setOpen(false) : go(1); },
                  children: index === __lcGuideSections.length - 1 ? "完成，开始实践" : "下一章"
                })
              ]
            })
          ]
        })
      ]
    })
  });
}

/* 样式集中注入，保留原有布局，只改善视觉层级、命中区域和键盘焦点。 */
__lcStyleOnce("lc-guide-style", [
  ".lc-guide-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:0 12px;border:1px solid #d3a400;border-radius:7px;background:#ffd34e;color:#342800;font-size:12px;font-weight:750;line-height:1;white-space:nowrap;cursor:pointer;box-shadow:0 1px 2px rgba(83,58,0,.12);transition:background .14s ease,border-color .14s ease,box-shadow .14s ease}",
  ".lc-guide-button:hover{background:#ffdf72;border-color:#bd9000;box-shadow:0 2px 5px rgba(83,58,0,.16)}",
  ".lc-guide-button:active{background:#f2c43d}",
  ".lc-guide-button-mark{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1.5px solid currentColor;border-radius:50%;font-size:12px;font-weight:800}",
  ".lc-guide-overlay{--guide-bg:#ffffff;--guide-side:#f5f7fa;--guide-text:#202832;--guide-muted:#687586;--guide-border:#dce2e9;--guide-soft:#edf4ff;--guide-accent:#245fc4;position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.52);backdrop-filter:blur(3px);color:var(--guide-text);font-family:Inter,Segoe UI,Microsoft YaHei,system-ui,sans-serif}",
  ".lc-guide-dialog{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(960px,100%);height:min(720px,calc(100vh - 40px));overflow:hidden;border:1px solid var(--guide-border);border-radius:16px;background:var(--guide-bg);box-shadow:0 28px 90px rgba(15,23,42,.28);outline:none}",
  ".lc-guide-header{display:flex;align-items:center;gap:12px;min-height:76px;border-bottom:1px solid var(--guide-border);padding:15px 20px;background:var(--guide-bg)}",
  ".lc-guide-brand-icon{display:flex;align-items:center;justify-content:center;width:38px;height:38px;flex:0 0 auto;border:1px solid #d3a400;border-radius:11px;background:#ffd34e;color:#342800;font-size:21px;font-weight:800}",
  ".lc-guide-heading{min-width:0;flex:1}.lc-guide-heading h2{margin:0;color:var(--guide-text);font-size:19px;line-height:1.35;letter-spacing:.01em}.lc-guide-heading p{margin:4px 0 0;color:var(--guide-muted);font-size:12px;line-height:1.5}",
  ".lc-guide-close{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex:0 0 auto;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--guide-muted);font-size:25px;line-height:1;cursor:pointer}.lc-guide-close:hover{border-color:var(--guide-border);background:var(--guide-side);color:var(--guide-text)}",
  ".lc-guide-body{display:grid;grid-template-columns:205px minmax(0,1fr);min-height:0}",
  ".lc-guide-nav{display:flex;flex-direction:column;gap:4px;min-height:0;overflow-y:auto;border-right:1px solid var(--guide-border);background:var(--guide-side);padding:18px 12px}",
  ".lc-guide-nav-caption{padding:0 10px 8px;color:var(--guide-muted);font-size:11px;font-weight:700;letter-spacing:.08em}",
  ".lc-guide-nav-item{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--guide-text);padding:7px 10px;font-size:13px;text-align:left;cursor:pointer;transition:background .14s ease,border-color .14s ease}",
  ".lc-guide-nav-item:hover{background:var(--guide-bg);border-color:var(--guide-border)}.lc-guide-nav-item.active{border-color:#bfd2ef;background:var(--guide-soft);color:var(--guide-accent);font-weight:700}",
  ".lc-guide-nav-number{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;flex:0 0 auto;border-radius:7px;background:var(--guide-border);color:var(--guide-muted);font-size:10px;font-weight:750;font-variant-numeric:tabular-nums}.lc-guide-nav-item.active .lc-guide-nav-number{background:var(--guide-accent);color:#fff}",
  ".lc-guide-nav-help{margin-top:auto;padding:16px 10px 0;color:var(--guide-muted);font-size:11px;line-height:1.8;white-space:pre-line}",
  ".lc-guide-content{min-width:0;overflow-y:auto;overscroll-behavior:contain;padding:26px 30px 30px;scrollbar-color:#b8c2ce transparent;scrollbar-width:thin}",
  ".lc-guide-content-head{margin-bottom:22px}.lc-guide-eyebrow{display:block;margin-bottom:7px;color:var(--guide-accent);font-size:11px;font-weight:750;letter-spacing:.04em}.lc-guide-content-head h3{margin:0;color:var(--guide-text);font-size:23px;line-height:1.4;letter-spacing:-.01em}.lc-guide-content-head p{max-width:680px;margin:9px 0 0;color:var(--guide-muted);font-size:13px;line-height:1.75}",
  ".lc-guide-block{margin:0 0 22px}.lc-guide-block-title{margin:0 0 11px;color:var(--guide-text);font-size:14px;line-height:1.5}",
  ".lc-guide-steps{display:grid;gap:9px;margin:0;padding:0;list-style:none}.lc-guide-steps li{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--guide-border);border-radius:10px;background:var(--guide-bg);padding:12px 14px}.lc-guide-step-number{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;flex:0 0 auto;margin-top:1px;border-radius:50%;background:var(--guide-soft);color:var(--guide-accent);font-size:12px;font-weight:800}.lc-guide-steps h4{margin:0 0 4px;color:var(--guide-text);font-size:13px;line-height:1.5}.lc-guide-steps p,.lc-guide-list p{margin:0;color:var(--guide-muted);font-size:12px;line-height:1.7}",
  ".lc-guide-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}.lc-guide-list li{min-width:0;border-left:3px solid #c9d7eb;background:var(--guide-side);border-radius:0 8px 8px 0;padding:11px 13px}.lc-guide-list strong{display:block;margin-bottom:4px;color:var(--guide-text);font-size:12px;line-height:1.5}",
  ".lc-guide-note{display:grid;grid-template-columns:110px minmax(0,1fr);gap:12px;align-items:start;margin:0 0 12px;border:1px solid #bfd5c7;border-radius:9px;background:#f0f8f3;padding:11px 14px}.lc-guide-note.warn{border-color:#ead29b;background:#fff8e7}.lc-guide-note strong{color:#28643e;font-size:12px;line-height:1.7}.lc-guide-note.warn strong{color:#805b0a}.lc-guide-note p{margin:0;color:#485b50;font-size:12px;line-height:1.7}.lc-guide-note.warn p{color:#6d572b}",
  ".lc-guide-keys{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 16px}.lc-guide-key{display:flex;align-items:center;gap:10px;min-height:34px;border-bottom:1px solid var(--guide-border);padding:4px 0;color:var(--guide-muted);font-size:12px}.lc-guide-key kbd{display:inline-flex;align-items:center;justify-content:center;min-width:74px;min-height:25px;border:1px solid var(--guide-border);border-bottom-width:2px;border-radius:6px;background:var(--guide-side);color:var(--guide-text);padding:3px 7px;font-family:inherit;font-size:11px;font-weight:650;white-space:nowrap}",
  ".lc-guide-content-end{border-top:1px solid var(--guide-border);padding-top:16px;color:var(--guide-muted);font-size:11px;text-align:center}",
  ".lc-guide-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:66px;border-top:1px solid var(--guide-border);background:var(--guide-bg);padding:12px 20px}.lc-guide-progress{display:flex;align-items:center;gap:10px;color:var(--guide-muted);font-size:11px;font-variant-numeric:tabular-nums}.lc-guide-progress-track{width:120px;height:5px;overflow:hidden;border-radius:99px;background:var(--guide-border)}.lc-guide-progress-track i{display:block;height:100%;border-radius:inherit;background:var(--guide-accent);transition:width .18s ease}",
  ".lc-guide-footer-actions{display:flex;gap:8px}.lc-guide-secondary,.lc-guide-primary{min-width:88px;min-height:36px;border-radius:7px;padding:0 14px;font-size:12px;font-weight:650;cursor:pointer}.lc-guide-secondary{border:1px solid var(--guide-border);background:var(--guide-bg);color:var(--guide-text)}.lc-guide-secondary:hover:not(:disabled){background:var(--guide-side)}.lc-guide-primary{border:1px solid var(--guide-accent);background:var(--guide-accent);color:#fff}.lc-guide-primary:hover{filter:brightness(.94)}",
  ":root[data-theme=dark] .lc-guide-overlay{--guide-bg:#202833;--guide-side:#19212b;--guide-text:#e2e8f0;--guide-muted:#a1adbc;--guide-border:#3a4654;--guide-soft:#253c5b;--guide-accent:#8bb5f2;background:rgba(3,8,15,.7)}",
  ":root[data-theme=dark] .lc-guide-dialog{box-shadow:0 28px 90px rgba(0,0,0,.55)}:root[data-theme=dark] .lc-guide-nav-item.active{border-color:#4c6687}:root[data-theme=dark] .lc-guide-nav-number{background:#303b48}:root[data-theme=dark] .lc-guide-nav-item.active .lc-guide-nav-number{background:#4779ba}",
  ":root[data-theme=dark] .lc-guide-list li{border-left-color:#4b6482}:root[data-theme=dark] .lc-guide-note{border-color:#355d49;background:#1d3429}:root[data-theme=dark] .lc-guide-note.warn{border-color:#68552e;background:#352e20}:root[data-theme=dark] .lc-guide-note strong{color:#91c8a6}:root[data-theme=dark] .lc-guide-note.warn strong{color:#e6c575}:root[data-theme=dark] .lc-guide-note p{color:#b4c8bb}:root[data-theme=dark] .lc-guide-note.warn p{color:#d2c29f}",
  "@media(max-width:760px){.lc-guide-overlay{padding:10px}.lc-guide-dialog{height:calc(100vh - 20px);border-radius:12px}.lc-guide-header{min-height:68px;padding:12px 14px}.lc-guide-heading p{display:none}.lc-guide-body{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.lc-guide-nav{flex-direction:row;gap:5px;border-right:0;border-bottom:1px solid var(--guide-border);padding:8px 10px;overflow-x:auto;overflow-y:hidden}.lc-guide-nav-caption,.lc-guide-nav-help{display:none}.lc-guide-nav-item{width:auto;min-width:max-content;min-height:36px;padding:5px 9px}.lc-guide-nav-number{width:22px;height:22px}.lc-guide-content{padding:20px 18px}.lc-guide-content-head h3{font-size:20px}.lc-guide-list,.lc-guide-keys{grid-template-columns:1fr}.lc-guide-note{grid-template-columns:1fr;gap:3px}.lc-guide-footer{padding:10px 14px}.lc-guide-progress-track{width:70px}}",
  "@media(max-width:460px){.lc-guide-brand-icon{display:none}.lc-guide-progress-track{display:none}.lc-guide-footer{gap:8px}.lc-guide-secondary,.lc-guide-primary{min-width:78px;padding:0 10px}}",
  "@media(prefers-reduced-motion:reduce){.lc-guide-button,.lc-guide-nav-item,.lc-guide-progress-track i{transition:none}}"
].join("\n"));

__lcStyleOnce("lc-ui-polish-style", [
  ".app-shell{grid-template-rows:52px 1fr}.header-bar{gap:12px;padding:0 12px;border-bottom-color:var(--ui-border);box-shadow:0 1px 3px rgba(26,38,52,.06)}",
  ".brand-mark{border-radius:6px}.brand-title{letter-spacing:.01em}.brand-subtitle{line-height:1.35}.header-actions{gap:6px}",
  ".project-action-select{height:32px;min-height:32px;border-radius:6px}.header-actions .icon-button{width:32px;min-height:32px;border-radius:6px}.header-actions .icon-button.active{border-color:#8fb3ea;background:var(--ui-accent-soft);color:var(--ui-accent)}",
  ".toolbar-scroll-inner{gap:7px;padding:4px 3px}.toolbar-group{gap:3px;border-color:var(--ui-border-soft);border-radius:7px;background:rgba(255,255,255,.28);padding:2px 3px}.toolbar-group-items{gap:2px}",
  ".toolbar-group .toolbar-menu-item{min-height:30px;border:1px solid transparent;border-radius:5px;padding:4px 8px;line-height:1.25;transition:background .14s ease,color .14s ease,border-color .14s ease}.toolbar-group .toolbar-menu-item:hover:not(:disabled){border-color:#c6d7ed;background:#eaf2fc;color:#174f9d}.toolbar-group .toolbar-menu-item.active{border-color:#9dbde8;background:var(--ui-accent-soft);color:var(--ui-accent);font-weight:650}",
  "button:focus-visible,select:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:2px solid #3978d4;outline-offset:2px}.lc-guide-button:focus-visible{outline-color:#8a6500;outline-offset:2px}",
  "button{touch-action:manipulation}button:disabled{opacity:.46}.toolbar-scroll-btn{border-radius:5px}.route-draft-status{line-height:1.4}",
  ":root[data-theme=dark] .header-bar{box-shadow:0 1px 4px rgba(0,0,0,.22)}:root[data-theme=dark] .toolbar-group{background:rgba(255,255,255,.015)}:root[data-theme=dark] .toolbar-group .toolbar-menu-item:hover:not(:disabled){border-color:#465a72;background:#27374a;color:#a9c9f3}:root[data-theme=dark] .toolbar-group .toolbar-menu-item.active{border-color:#52739b;background:#263d5a;color:#b4d1f5}",
  "@media(prefers-reduced-motion:reduce){.toolbar-group .toolbar-menu-item{transition:none}}"
].join("\n"));
