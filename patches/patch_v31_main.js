/* ===== __lc v3.1: 自定义封装（开发板/模块） + 软件内网络编辑 ===== */
var __lcFP_KEY = "lc-user-footprints";
function __lcUserFpLoad(){
  try{var a=JSON.parse(localStorage.getItem(__lcFP_KEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}
}
function __lcUserFpSave(list){try{localStorage.setItem(__lcFP_KEY,JSON.stringify(list))}catch(e){}}
function __lcFpTemplate(name,rows,rowSp){
  var n=Math.max(2,Math.min(40,Math.round(Number(rows)||15)));
  var r=Math.max(3,Math.min(8,Math.round(Number(rowSp)||6)));
  var pc=n*2;
  var lb=String(name||"").toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,8)||"BOARD";
  return{kind:"dev_board",label:lb,title:(String(name||"").trim()||"自定义封装")+" 2×"+n,pinCount:pc,leadSpacing:1,rowSpacing:r,sameSidePitch:1,pinOffsets:L3(pc,r,1)};
}
function __lcDevBoard3D(cfg){
  var off=(cfg&&cfg.pinOffsets&&cfg.pinOffsets.length)?cfg.pinOffsets:[[0,0],[6,0]];
  var g=new Re;
  var bx=Ji(off);
  var body=new Vt(new Cs(Math.max(1.4,bx.width+1.4),.18,Math.max(1,bx.height+1.2)),new Pe({color:1450384,roughness:.55,metalness:.05}));
  body.position.set(bx.centerX,.74,bx.centerZ);
  body.castShadow=!0;
  g.add(body);
  var usb=new Vt(new Cs(.9,.32,.85,2,.03),Ne.lead);
  usb.position.set(bx.centerX-bx.width/2+.45,1,bx.centerZ);
  g.add(usb);
  off.forEach(function(p){
    var pad=new Vt(new Cs(.3,.05,.3,1,.01),Ne.copper);
    pad.position.set(p[0],.85,p[1]);
    g.add(pad);
    var post=new Vt(new Cs(.17,1.05,.17,1,.015),Ne.brass);
    post.position.set(p[0],.95,p[1]);
    g.add(post);
  });
  Un(g,String(cfg&&cfg.label?cfg.label:"DEV"),bx.centerX,1.3,bx.centerZ,16768467,Math.min(2.6,Math.max(1.2,bx.width*.5)));
  return g;
}
function LcFpPanel(param){
  var onPick=param.onPick,close=param.close;
  var a=qt.useState(""),name=a[0],setName=a[1];
  var b=qt.useState(15),rows=b[0],setRows=b[1];
  var c=qt.useState(6),rowSp=c[0],setRowSp=c[1];
  var d=qt.useState(__lcUserFpLoad()),saved=d[0],setSaved=d[1];
  var fp=__lcFpTemplate(name,rows,rowSp);
  return P.jsxs("section",{className:"pin-header-configurator lc-fp-panel","aria-label":"自定义封装",children:[
    P.jsxs("div",{className:"pin-header-configurator-heading",children:[
      P.jsx("strong",{children:"自定义封装（开发板 / 模块）"}),
      P.jsxs("span",{children:["2×"+Math.max(2,Math.round(rows))+"，共 "+fp.pinCount+" 脚，排距 "+fp.rowSpacing+" 孔"]})
    ]}),
    P.jsxs("div",{className:"lc-fp-fields",children:[
      P.jsxs("label",{children:[P.jsx("span",{children:"名称"}),P.jsx("input",{value:name,placeholder:"如 NANO",maxLength:8,onChange:function(E){setName(E.target.value)}})]}),
      P.jsxs("label",{children:[P.jsx("span",{children:"每排脚数"}),P.jsx("input",{type:"number",min:2,max:40,value:rows,onChange:function(E){var v=Number(E.target.value);setRows(Number.isFinite(v)?Math.max(2,Math.min(40,Math.round(v))):2)}})]}),
      P.jsxs("label",{children:[P.jsx("span",{children:"排距（孔）"}),P.jsx("input",{type:"number",min:3,max:8,value:rowSp,onChange:function(E){var v=Number(E.target.value);setRowSp(Number.isFinite(v)?Math.max(3,Math.min(8,Math.round(v))):6)}})]})
    ]}),
    P.jsxs("div",{className:"lc-fp-row",children:[
      P.jsx("img",{className:"lc-thumb",alt:"",src:__lcThumb("dev_board",fp.label,fp.pinCount,fp.pinOffsets)}),
      P.jsx("button",{className:"tool-button primary",type:"button",onClick:function(){onPick(fp),close()},children:"放置"}),
      P.jsx("button",{className:"tool-button",type:"button",onClick:function(){
        var list=saved.filter(function(x){return x.label!==fp.label}).concat([{label:fp.label,rows:Math.max(2,Math.round(rows)),rowSpacing:fp.rowSpacing}]);
        setSaved(list);__lcUserFpSave(list);
      },children:"保存到库"})
    ]}),
    P.jsx("small",{children:"排距 6 孔 ≈ 15.24 mm（Nano / ESP32 / Pico 的双排孔距）；排距 3 孔 = DIP 芯片。面包板上会要求跨中央沟槽。"}),
    saved.length>0&&P.jsxs("div",{className:"lc-fp-saved",children:[
      P.jsx("strong",{children:"已保存的封装"}),
      saved.map(function(x){return P.jsxs("div",{className:"lc-fp-saved-row",children:[
        P.jsx("button",{className:"text-button",type:"button",onClick:function(){onPick(__lcFpTemplate(x.label,x.rows,x.rowSpacing)),close()},children:(x.label+"　2×"+(Math.round(Number(x.rows)||2)*2)+" 脚 / 排距 "+(Math.round(Number(x.rowSpacing)||6)))}),
        P.jsx("button",{className:"text-button danger",type:"button",onClick:function(){var list=saved.filter(function(y){return y.label!==x.label});setSaved(list);__lcUserFpSave(list)},children:"删除"})
      ]},"lcfp-"+x.label)})
    ]})
  ]});
}
function __lcNetAfter(p,next){
  return{...next,routing:{...next.routing,drc:void 0,diagnostics:void 0}};
}
function __lcNetCommit(fn){
  var c=window.__lcCommit;
  if(!c){return}
  c(function(p){var next=fn(p);return next===p?p:__lcNetAfter(p,next)});
}
function __lcNetAddTo(p,nm,ref,pin){
  var pn=String(pin);
  var nets=p.importState.nets.map(function(n){
    var keep=n.nodes.filter(function(nd){return!(nd.ref===ref&&nd.pin===pn)});
    return keep.length===n.nodes.length?n:{...n,nodes:keep};
  });
  var hit=null;
  for(var i=0;i<nets.length;i+=1)if(nets[i].name===nm){hit=nets[i];break}
  if(!hit){hit={name:nm,nodes:[]};nets=nets.concat([hit])}
  var nodes=hit.nodes.filter(function(nd){return!(nd.ref===ref&&nd.pin===pn)}).concat([{ref:ref,pin:pn}]);
  nets=nets.map(function(n){return n===hit?{...n,nodes:nodes}:n});
  return{...p,importState:{...p.importState,nets:nets}};
}
function __lcNetAdd(nm,ref,pin){__lcNetCommit(function(p){return __lcNetAddTo(p,nm,ref,pin)})}
function __lcNetEnsure(nm){
  __lcNetCommit(function(p){
    var has=p.importState.nets.some(function(n){return n.name===nm});
    if(has)return p;
    return{...p,importState:{...p.importState,nets:p.importState.nets.concat([{name:nm,nodes:[]}])}};
  })
}
function __lcNetDel(nm,ref,pin){
  var pn=String(pin);
  __lcNetCommit(function(p){
    var nets=p.importState.nets.map(function(n){return n.name!==nm?n:{...n,nodes:n.nodes.filter(function(nd){return!(nd.ref===ref&&nd.pin===pn)})}}).filter(function(n){return n.name!==nm||n.nodes.length>0});
    return{...p,importState:{...p.importState,nets:nets}};
  })
}
function __lcNetDelNet(nm){
  __lcNetCommit(function(p){
    var nets=p.importState.nets.filter(function(n){return n.name!==nm});
    return{...p,importState:{...p.importState,nets:nets},routing:{...p.routing,traces:p.routing.traces.filter(function(t){return t.net!==nm}),jumpers:p.routing.jumpers.filter(function(j){return j.net!==nm}),failedNets:p.routing.failedNets.filter(function(f){return f!==nm}),drc:void 0,diagnostics:void 0},selectedNetName:p.selectedNetName===nm?void 0:p.selectedNetName};
  })
}
function __lcNetAutoName(p){
  var i=1;
  var names=new Set(p.importState.nets.map(function(n){return n.name}));
  while(names.has("N"+i))i+=1;
  return"N"+i;
}
function __lcPinFromEvent(ev){
  try{
    var sc=window.__lcScene,cm=window.__lcCamera,cv=window.__lcCanvas,pj=window.__lcProject,ba=window.__lcBoardArgs;
    if(!sc||!cm||!cv||!pj||!ba)return null;
    var r=cv.getBoundingClientRect();
    if(r.width<2||r.height<2)return null;
    var ndc=new Ot((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height*2+1));
    var rc=new Xv;
    rc.setFromCamera(ndc,cm);
    var o=rc.ray.origin,d=rc.ray.direction;
    var bw=ba.board.width,bh=ba.board.height;
    var best=null,bestD=.62;
    pj.components.forEach(function(c){
      if(!c.mounted)return;
      for(var i=0;i<c.pinOffsets.length;i+=1){
        var g=Si(c,i+1);
        var px=g[0]-bw/2+.5,pz=g[1]-bh/2+.5,py=.95;
        var vx=px-o.x,vy=py-o.y,vz=pz-o.z;
        var t=vx*d.x+vy*d.y+vz*d.z;
        if(t<0)continue;
        var dx=vx-d.x*t,dy=vy-d.y*t,dz=vz-d.z*t;
        var dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(dist<bestD){bestD=dist;best={ref:c.name,pin:i+1,x:px,z:pz}}
      }
    });
    return best;
  }catch(e){return null}
}
function __lcPickMarkerEnsure(){
  var m=window.__lcPickMarker;
  if(m&&m.parent)return m;
  m=new Vt(new Ki(.24,16,12),new Pe({color:16753920,roughness:.35,emissive:10079232}));
  m.renderOrder=8;
  window.__lcScene.add(m);
  window.__lcPickMarker=m;
  return m;
}
function __lcPickHover(ev){
  var m=__lcPickMarkerEnsure();
  var hit=__lcPinFromEvent(ev);
  if(!hit){m.visible=!1;return}
  m.visible=!0;
  m.position.set(hit.x,1.55,hit.z);
}
function __lcPickStop(){
  window.__lcPicking=null;
  var b=document.getElementById("lc-pick-banner");
  if(b&&b.parentNode)b.parentNode.removeChild(b);
  var m=window.__lcPickMarker;
  if(m){
    try{
      if(m.parent)m.parent.remove(m);
      if(m.geometry&&m.geometry.dispose)m.geometry.dispose();
      if(m.material&&m.material.dispose)m.material.dispose();
    }catch(e){}
    window.__lcPickMarker=null;
  }
}
function __lcPickStart(net,onPick){
  __lcPickStop();
  var cnt=0;
  var b=document.createElement("div");
  b.id="lc-pick-banner";
  b.textContent="拾取 "+net+"：点击板上要相连的引脚（已加 0 个 · Esc / 右键结束）";
  document.body.appendChild(b);
  window.__lcPicking={net:net,cb:function(hit){
    var pj=window.__lcProject;
    if(!pj||!(pj.importState&&pj.importState.nets)||!pj.importState.nets.some(function(n){return n.name===net})){__lcPickStop();return}
    var ok=!1;
    try{onPick(hit);ok=!0}catch(e){}
    if(ok){cnt+=1;b.textContent="拾取 "+net+"：点击要相连的引脚（已加 "+cnt+" 个 · Esc / 右键结束）"}
  }};
}
document.addEventListener("pointerdown",function(ev){
  var pk=window.__lcPicking;
  if(!pk)return;
  if(ev.button===2){ev.preventDefault();ev.stopPropagation();__lcPickStop();return}
  var hit=__lcPinFromEvent(ev);
  if(hit){ev.preventDefault();ev.stopPropagation();try{pk.cb(hit)}catch(e){}}
},!0);
document.addEventListener("pointermove",function(ev){
  if(!window.__lcPicking)return;
  __lcPickHover(ev);
},!0);
document.addEventListener("keydown",function(ev){
  if(ev.key==="Escape"&&window.__lcPicking)__lcPickStop();
},!0);
document.addEventListener("contextmenu",function(ev){
  if(window.__lcPicking){ev.preventDefault();ev.stopPropagation()}
},!0);
function __lcNetPanel(t){
  var proj=t&&t.project;
  var onSelectNet=t&&t.onSelectNet;
  var sa=qt.useState("");
  var newName=sa[0];
  var setNewName=sa[1];
  var sb=qt.useState(null);
  var pickNet=sb[0];
  var setPickNet=sb[1];
  var sc=qt.useState("");
  var selRef=sc[0];
  var setSelRef=sc[1];
  var sd=qt.useState(1);
  var selPin=sd[0];
  var setSelPin=sd[1];
  if(!proj)return null;
  var comps=proj.components||[];
  var nets=(proj.importState&&proj.importState.nets)||[];
  var nameSet=new Set(comps.map(function(c){return c.name}));
  var netsSorted=nets.slice().sort(function(a,b){return $S(b.name)-$S(a.name)||a.name.localeCompare(b.name,void 0,{numeric:!0})});
  var pickNetObj=null;
  for(var q0=0;q0<nets.length;q0+=1)if(nets[q0].name===pickNet){pickNetObj=nets[q0];break}
  if(pickNet&&!pickNetObj)setPickNet(null);
  var selComp=null;
  for(var i=0;i<comps.length;i+=1)if(comps[i].name===selRef){selComp=comps[i];break}
  var autoPick=function(nm){
    __lcNetEnsure(nm);
    if(comps.length===0)return;
    setPickNet(nm);
    __lcPickStart(nm,function(hit){__lcNetAdd(nm,hit.ref,hit.pin)});
  };
  return P.jsxs("section",{className:"sidebar-section lc-net-section",children:[
    P.jsx("h2",{children:"网络连接"}),
    P.jsxs("div",{className:"parsed-list",children:[
      P.jsx("div",{className:"parsed-list-header",children:P.jsx("h3",{children:"新建网络"})}),
      P.jsxs("div",{className:"lc-net-new",children:[
        P.jsx("input",{className:"lc-inp lc-net-inp-name",value:newName,placeholder:"网络名（留空自动编号）",onChange:function(E){setNewName(E.target.value)}}),
        P.jsx("button",{className:"tool-button lc-net-add",type:"button",onClick:function(){
          var nm=newName.trim()||__lcNetAutoName(proj);
          setNewName("");
          autoPick(nm);
        },children:"新建"}),
        P.jsx("button",{className:"text-button",type:"button",title:"新建 GND 网络并立即拾取",onClick:function(){autoPick("GND")},children:"GND"}),
        P.jsx("button",{className:"text-button",type:"button",title:"新建 5V 网络并立即拾取",onClick:function(){autoPick("5V")},children:"5V"})
      ]}),
      P.jsx("div",{className:"lc-net-tip",children:comps.length===0?"先从「元件库」放几个元件，再来这里连线：输入名字点「新建」，直接点板上的引脚就能连成一网。":"输入名字点「新建」→ 立即进入拾取：在 3D 板上依次点击要相连的引脚（可跨元件），Esc 结束。这是把引脚「连成一堆」的连接关系，飞线 / 自动布线 / DRC 即刻可用。"})
    ]}),
    nets.length>0&&P.jsxs("div",{className:"parsed-list",children:[
      P.jsxs("div",{className:"parsed-list-header",children:[
        P.jsx("h3",{children:"网络列表"}),
        P.jsx("span",{className:"lc-net-hint"+(pickNet?" lc-net-hint-on":""),children:pickNet?"拾取中…":""})
      ]}),
      P.jsx("div",{className:"lc-net-list",children:netsSorted.map(function(n){
        var picking=pickNet===n.name;
        return P.jsxs("div",{className:"lc-net-item"+(picking?" picking":""),children:[
          P.jsxs("div",{className:"lc-net-head",children:[
            P.jsx("button",{className:"text-button lc-net-name",type:"button",title:"在 3D 视图高亮该网络",onClick:function(){onSelectNet&&onSelectNet(n.name)},children:n.name}),
            P.jsx("span",{className:"lc-net-count",children:n.nodes.length+" 脚"}),
            P.jsx("button",{className:"text-button"+(picking?" lc-net-picking":""),type:"button",title:"在板上点击引脚加入该网络",onClick:function(){
              if(picking){setPickNet(null);__lcPickStop();return}
              setPickNet(n.name);
              __lcPickStart(n.name,function(hit){__lcNetAdd(n.name,hit.ref,hit.pin)});
            },children:picking?"停止":"拾取"}),
            P.jsx("button",{className:"text-button danger",type:"button",title:"删除整个网络",onClick:function(){__lcNetDelNet(n.name)},children:"删"})
          ]}),
          n.nodes.length===0&&P.jsx("div",{className:"lc-net-empty",children:"空网络：点「拾取」后直接点板上引脚加入"}),
          n.nodes.length>0&&P.jsx("div",{className:"lc-net-nodes",children:n.nodes.map(function(nd,idx){
            return P.jsxs("span",{className:"lc-net-chip"+(nameSet.has(nd.ref)?"":" miss"),title:nameSet.has(nd.ref)?null:"元件不存在（可能已改名或删除），该连接当前失效",children:[
              nd.ref+"."+nd.pin,
              P.jsx("button",{type:"button",title:"从网络移除该引脚",onClick:function(){__lcNetDel(n.name,nd.ref,nd.pin)},children:"×"})
            ]},"chip-"+n.name+"-"+nd.ref+"-"+nd.pin+"-"+idx)
          })})
        ]},"net-"+n.name)
      })})
    ]}),
    comps.length>0&&nets.length>0&&P.jsxs("div",{className:"parsed-list",children:[
      P.jsx("div",{className:"parsed-list-header",children:P.jsx("h3",{children:"手动添加引脚"})}),
      P.jsxs("div",{className:"lc-net-grid",children:[
        P.jsx("select",{className:"lc-inp",value:selRef,onChange:function(E){setSelRef(E.target.value);setSelPin(1)},children:[
          P.jsx("option",{value:"",children:"元件…"}),
          comps.map(function(cp){return P.jsx("option",{value:cp.name,children:cp.name+(cp.value?" / "+cp.value:"")},"opt-"+cp.id)})
        ]}),
        P.jsx("select",{className:"lc-inp",value:selPin,disabled:!selComp,onChange:function(E){setSelPin(Number(E.target.value))},children:(selComp?selComp.pinOffsets:[]).map(function(_,idx){
          var on=null;
          for(var q=0;q<nets.length;q+=1)for(var w=0;w<nets[q].nodes.length;w+=1)if(nets[q].nodes[w].ref===selComp.name&&nets[q].nodes[w].pin===String(idx+1)){on=nets[q].name;break}
          return P.jsxs("option",{value:idx+1,children:["脚 "+(idx+1)+(on?"（"+on+"）":"")]},"pin-"+(idx+1));
        })}),
        P.jsx("select",{className:"lc-inp",value:"",disabled:!selComp,onChange:function(E){
          var nm=E.target.value;
          if(nm&&selComp)__lcNetAdd(nm,selComp.name,selPin);
        },children:[
          P.jsx("option",{value:"",children:"加入网络…"}),
          netsSorted.map(function(n){return P.jsx("option",{value:n.name,children:n.name},"to-"+n.name)})
        ]})
      ]})
    ]})
  ]});
}
function __lcNetStyle(){
  var el=document.getElementById("lc-net-style");
  if(el)return;
  var st=document.createElement("style");
  st.id="lc-net-style";
  st.textContent="#lc-pick-banner{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--ui-accent-soft,#223550);border:1px solid var(--ui-accent,#6f9fe8);color:var(--ui-text,#d5dce5);padding:6px 16px;border-radius:3px;font-size:12px;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none}.lc-net-section .lc-inp{height:26px;border:1px solid var(--ui-border,#cbd5df);border-radius:2px;background:#fff;color:var(--ui-text,#1e242b);padding:0 6px;font-size:12px;min-width:0}.lc-net-section .lc-inp:focus{border-color:var(--ui-accent,#235bdb);outline:1px solid #b9d2ff}.lc-net-section .lc-net-new{display:flex;align-items:center;gap:6px;padding:8px 8px 0}.lc-net-section .lc-net-inp-name{flex:1}.lc-net-section .lc-net-add{min-height:26px;padding:0 12px;font-size:11px}.lc-net-section .lc-net-new .text-button{margin-top:0}.lc-net-section .lc-net-tip{padding:6px 8px 8px;color:var(--ui-muted,#667085);font-size:11px;line-height:1.5}.lc-net-section .lc-net-hint{color:var(--ui-muted,#667085);font-size:11px;font-weight:400}.lc-net-section .lc-net-hint-on{color:var(--ui-accent,#235bdb);font-weight:600}.lc-net-section .lc-net-list{max-height:300px;overflow:auto}.lc-net-section .lc-net-item{padding:6px 8px;border-bottom:1px solid var(--ui-border-soft,#edf0f4)}.lc-net-section .lc-net-item:last-child{border-bottom:0}.lc-net-section .lc-net-item.picking{background:var(--ui-accent-soft,#eaf1fd)}.lc-net-section .lc-net-empty{padding:3px 0 0;color:var(--ui-muted,#667085);font-size:10px}.lc-net-section .lc-net-head{display:flex;align-items:center;gap:8px;min-height:22px}.lc-net-section .lc-net-head .text-button{margin-top:0}.lc-net-section .lc-net-name{font-weight:700;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lc-net-section .lc-net-count{color:var(--ui-muted,#667085);font-size:11px;margin-right:auto}.lc-net-section .lc-net-picking{color:#b42318}:root[data-theme=dark] .lc-net-section .lc-net-picking{color:#f0b9b2}.lc-net-section .lc-net-nodes{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.lc-net-section .lc-net-chip{display:inline-flex;align-items:center;gap:3px;background:var(--ui-accent-soft,#eaf1fd);color:var(--ui-accent,#255da8);border-radius:2px;padding:1px 5px;font-size:11px;line-height:18px}:root[data-theme=dark] .lc-net-section .lc-net-chip{color:#9fc0f5}.lc-net-section .lc-net-chip button{border:0;background:none;color:inherit;cursor:pointer;font-size:12px;line-height:1;padding:0 1px;opacity:.6}.lc-net-section .lc-net-chip button:hover{opacity:1}.lc-net-section .lc-net-chip.miss{background:#f6e5e3;color:#b42318;opacity:.8;text-decoration:line-through}:root[data-theme=dark] .lc-net-section .lc-net-chip.miss{background:#3a211e;color:#f0b9b2}.lc-net-section .lc-net-grid{display:grid;grid-template-columns:1.2fr .7fr 1fr;gap:6px;padding:8px}.lc-net-section .lc-net-grid select:disabled{opacity:.5}:root[data-theme=dark] .lc-net-section .lc-inp{background:#252e39}.lc-fp-panel .lc-fp-fields input{width:100%;height:32px;border:1px solid var(--ui-border,#c7d1df);border-radius:3px;background:#fff;color:var(--ui-text,#1e242b);padding:0 8px}:root[data-theme=dark] .lc-fp-panel .lc-fp-fields input{background:#252e39}.lc-fp-panel .lc-fp-row .tool-button{min-height:26px;padding:0 12px;font-size:11px}.lc-fp-panel .lc-fp-saved{border-top:1px solid var(--ui-border-soft);padding-top:8px;margin-top:2px}.lc-fp-panel .lc-fp-saved strong{font-size:11px;font-weight:750;opacity:.75}.lc-fp-panel .lc-fp-saved-row .text-button{margin-top:0}";
  document.head.appendChild(st);
}
__lcNetStyle();
