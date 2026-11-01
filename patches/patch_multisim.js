/* ===== __lc v3.2: Multisim 报告导入（Wire List + Cross Reference） =====
 * 数据流：文件 → __lcSniff 嗅探 → Multisim 表格解析（两遍：先建引脚缓存，再统一转换）
 * → 合成 KiCad S-expression → 复用现有 e4 解析 / 类别规则 / 布线管线。
 * 格式规范来自上游 v1.0.0 的实现（Wire List：多空格/Tab 分列，[网络名, …, RefDes, Pin]；
 * Cross Reference：[RefDes, Value, Category, Package]；未连接网络名含 _uc；电源/地符号忽略）。
 */
function __lcMSSplit2(line){
  return line.split(/\s{2,}|\t+/).map(function(x){return x.trim()}).filter(Boolean);
}
function __lcMSSplitCsv(line){
  var out=[],cur="",q=!1;
  for(var i=0;i<line.length;i+=1){
    var c=line[i];
    if(q){
      if(c==='"'){if(line[i+1]==='"'){cur+='"';i+=1}else{q=!1}}
      else cur+=c;
    }else if(c==='"')q=!0;
    else if(c===","){out.push(cur.trim());cur=""}
    else cur+=c;
  }
  out.push(cur.trim());
  return out.filter(function(x,i,a){return x!==""||i<a.length-1});
}
function __lcMSIsSep(line){return /^-+$/.test(line.trim())}
function __lcMSCsvMode(text){
  var lines=String(text).split(/\r?\n/),two=0,commas=0,n=0;
  for(var i=0;i<lines.length&&n<60;i+=1){
    var l=lines[i];
    if(!l.trim()||__lcMSIsSep(l))continue;
    n+=1;
    if(/\s{2,}|\t/.test(l))two+=1;
    if((l.match(/,/g)||[]).length>=2)commas+=1;
  }
  return n>0&&two===0&&commas>=Math.max(1,Math.floor(n*.6));
}
function __lcMSFoldRef(ref){
  var m=String(ref).match(/^([A-Za-z]+\d+)[A-Z]$/);
  return m?m[1]:String(ref);
}
function __lcMSPkgPins(pkg,refPrefix){
  var p=String(pkg||"").toUpperCase();
  if(refPrefix!=="U"&&refPrefix!=="A")return void 0;
  if(p.indexOf("CASE751A")>=0)return 14;
  var m=p.match(/(?:DIP|PDIP|SDIP|SO|SOP|SOIC)-?P?-?(\d+)/i)||p.match(/\bD0?(\d+)\b/i)||p.match(/\bN0?(\d+)\b/i)||p.match(/(\d+)\s*PIN/i);
  if(!m)return void 0;
  var n=Number(m[1]);
  return n>=4&&n<=64?n:void 0;
}
var __lcMSDefPins={"Device:R":2,"Device:C":2,"Device:CP":2,"Device:L":2,"Device:D":2,"Device:LED":2,"Device:R_Potentiometer":3,"Transistor_BJT:NPN":3,"Transistor_FET:MOSFET":3,"Diode_Bridge:BR":4,"Relay:Relay_SPDT":5,"Device:Crystal":2,"Device:FUSE":2,"Device:Buzzer":2,"Switch:SW_SPDT":3,"Switch:SW_DIP":8,"Button:SW_Push":4,"TerminalBlock:TerminalBlock":2,"TestPoint:TestPoint":1,"Display_Character:7SEG":10,"Display_Character:ALNUM":18,"Socket:DIP":8,"Connector_Generic:Conn":2,"Unknown:GENERIC":2};
function __lcMSVocab(ref,value,category,pkg){
  var r=String(ref||"").toUpperCase();
  var v=String(value||"").toUpperCase();
  var c=String(category||"").toUpperCase();
  var p=String(pkg||"").toUpperCase();
  var pre=(r.match(/^[A-Z]+/)||[""])[0];
  if(pre==="LED"||c.indexOf("LED")>=0)return"Device:LED";
  if(c.indexOf("BRIDGE")>=0||c.indexOf("FULLWAVE")>=0)return"Diode_Bridge:BR";
  if(c.indexOf("POTENTIOMETER")>=0||c.indexOf("VARIABLE_RESISTOR")>=0||v.indexOf("POT")>=0)return"Device:R_Potentiometer";
  if(p.indexOf("TO-220")>=0||p.indexOf("TO220")>=0)return"Transistor_FET:MOSFET";
  if(c.indexOf("RELAY")>=0||pre==="K"||pre==="RL")return"Relay:Relay_SPDT";
  if(c.indexOf("CRYSTAL")>=0||c.indexOf("XTAL")>=0||pre==="Y"||pre==="X")return"Device:Crystal";
  if(c.indexOf("FUSE")>=0)return"Device:FUSE";
  if(c.indexOf("BUZZER")>=0||v.indexOf("BUZZER")>=0||pre==="BZ"||pre==="LS")return"Device:Buzzer";
  if(c.indexOf("DIPSW")>=0||v.indexOf("DIPSW")>=0||p.indexOf("DIPSW")>=0)return"Switch:SW_DIP";
  if(c.indexOf("SEVEN_SEG")>=0||c.indexOf("7SEG")>=0||v.indexOf("SEVEN_SEG")>=0||v.indexOf("7SEG")>=0)return"Display_Character:7SEG";
  if(c.indexOf("ALPHA")>=0)return"Display_Character:ALNUM";
  if(c.indexOf("TACT")>=0||c.indexOf("PUSH")>=0||c.indexOf("BUTTON")>=0)return"Button:SW_Push";
  if(c.indexOf("SWITCH")>=0||c.indexOf("SPDT")>=0||p.indexOf("SPDT")>=0||pre==="SW"||pre==="S")return"Switch:SW_SPDT";
  if(c.indexOf("TERMINAL")>=0)return"TerminalBlock:TerminalBlock";
  if(c.indexOf("TESTPOINT")>=0||pre==="TP")return"TestPoint:TestPoint";
  if(c.indexOf("DIODE")>=0||c.indexOf("ZENER")>=0||pre==="D")return"Device:D";
  if(c.indexOf("ELECT")>=0||(c.indexOf("CAP")>=0&&/^\d+(\.\d+)?(U|µ)F/.test(v)))return"Device:CP";
  if(c.indexOf("CAP")>=0||pre==="C")return"Device:C";
  if(c.indexOf("INDUCTOR")>=0||pre==="L")return"Device:L";
  if(c.indexOf("RESISTOR")>=0||pre==="R")return"Device:R";
  if(p.indexOf("TO-92")>=0||p.indexOf("TO92")>=0||c.indexOf("BJT")>=0||c.indexOf("TRANSISTOR")>=0||pre==="Q")return"Transistor_BJT:NPN";
  if(c.indexOf("HEADER")>=0||c.indexOf("CONN")>=0||pre==="J"||pre==="P"||pre==="CN")return"Connector_Generic:Conn";
  if(pre==="U"||pre==="A"||c.indexOf("IC")>=0||c.indexOf("TIMER")>=0||c.indexOf("OPAMP")>=0||c.indexOf("OP-AMP")>=0||c.indexOf("MCU")>=0||/^74/.test(c)||/^40/.test(c)||c.indexOf("LOGIC")>=0||c.indexOf("MIXED")>=0||c.indexOf("ANALOG")>=0)return"Socket:DIP";
  return"Unknown:GENERIC";
}
function __lcMSIgnored(ref,value,category){
  var r=String(ref).trim(),v=String(value).trim().toUpperCase(),c=String(category).toUpperCase();
  return c==="POWER_SOURCES"||c.indexOf("VOLTAGE_SOURCES")>=0||c.indexOf("POWER")>=0&&c.indexOf("SOURCE")>=0||r==="0"||v==="GROUND"||v==="VCC"||v==="VDD"||v==="GND";
}
function __lcMSRefOk(ref){
  return/^(R|C|L|LED|D|Q|U|J|P|S|SW|RV|V|A|TP|K|CN|0)[A-Za-z0-9_+-]*$/i.test(String(ref));
}
function __lcMSWireParse(text,name){
  var csv=__lcMSCsvMode(text);
  var lines=String(text).split(/\r?\n/);
  var nets=new Map(),refs=new Map(),rows=0;
  for(var i=0;i<lines.length;i+=1){
    var l=lines[i];
    if(!l.trim()||__lcMSIsSep(l))continue;
    var f=csv?__lcMSSplitCsv(l):__lcMSSplit2(l);
    if(f.length<3)continue;
    if(f[0].toUpperCase()==="REFDES")continue;
    var net=f[0],ref=f[f.length-2],pin=f[f.length-1];
    if(!net||!ref||!pin)continue;
    if(ref.toUpperCase()==="REFDES"||/^PIN[#\d\s]*$/.test(pin.toUpperCase()))continue;
    if(/_uc/i.test(net)||net.toLowerCase()==="net")continue;
    if(!__lcMSRefOk(ref))continue;
    ref=__lcMSFoldRef(ref);
    pin=pin.toUpperCase().replace(/\s+/g,"");
    var arr=nets.get(net);
    if(!arr){arr=[];nets.set(net,arr)}
    arr.push({ref:ref,pin:pin});
    var set=refs.get(ref);
    if(!set){set=new Set();refs.set(ref,set)}
    set.add(pin);
    rows+=1;
  }
  return{nets:nets,refs:refs,rows:rows,name:name};
}
function __lcMSRenumber(set){
  var pins=Array.from(set);
  var nums=[],words=[];
  pins.forEach(function(p){if(/^\d+$/.test(p))nums.push(Number(p));else words.push(p)});
  nums.sort(function(a,b){return a-b});
  words.sort(function(a,b){return a.localeCompare(b,void 0,{numeric:!0})});
  var map=new Map,next=nums.length>0?nums[nums.length-1]+1:1;
  nums.forEach(function(n){map.set(String(n),n)});
  words.forEach(function(w){map.set(w,next);next+=1});
  return map;
}
function __lcMSXRefParse(text,name){
  var csv=__lcMSCsvMode(text);
  var lines=String(text).split(/\r?\n/);
  var comps=[],ignored=0;
  for(var i=0;i<lines.length;i+=1){
    var l=lines[i];
    if(!l.trim()||__lcMSIsSep(l))continue;
    var f=csv?__lcMSSplitCsv(l):__lcMSSplit2(l);
    if(f.length<3)continue;
    if(f[0].toUpperCase()==="REFDES")continue;
    var ref=f[0],value=f[1]||"",category=f[2]||"",pkg=f[3]||"-";
    if(!__lcMSRefOk(ref))continue;
    if(__lcMSIgnored(ref,value,category)){ignored+=1;continue}
    ref=__lcMSFoldRef(ref);
    var hit=null;
    for(var j=0;j<comps.length;j+=1)if(comps[j].ref===ref){hit=comps[j];break}
    if(!hit){hit={ref:ref,value:"",category:"",pkg:"-"};comps.push(hit)}
    if(!hit.value)hit.value=value;
    if(!hit.category)hit.category=category;
    if(hit.pkg==="-"&&pkg&&pkg!=="-")hit.pkg=pkg;
  }
  return{comps:comps,ignored:ignored,name:name};
}
function __lcSniff(text){
  var s=String(text||"");
  if(/^\s*PROTEL\s+NETLIST/i.test(s))return"protel";
  if(/^\s*\(export\b/.test(s))return"kicad";
  var lines=s.split(/\r?\n/),wireish=0,xrefish=0,checked=0;
  var refLike=function(x){return/^[A-Z]{1,4}\d+[A-Z]?$/.test(String(x).toUpperCase())};
  var pinLike=function(x){return/^\d{1,3}$|^[A-Z]{1,2}$/.test(String(x).toUpperCase())};
  for(var i=0;i<lines.length&&checked<80;i+=1){
    var l=lines[i];
    if(!l.trim()||__lcMSIsSep(l))continue;
    checked+=1;
    if(/^\s*[(;]/.test(l))return"text";
    var f=__lcMSSplit2(l);
    if(f.length<3){if(__lcMSSplitCsv(l).length>=3)f=__lcMSSplitCsv(l);else continue}
    var head=f.join(" ").toUpperCase();
    if(head.indexOf("REFDES")>=0){
      if(f[0].toUpperCase()==="REFDES")xrefish+=1;else wireish+=1;
      continue;
    }
    if(f.length<3)continue;
    if(refLike(f[f.length-2])&&pinLike(f[f.length-1]))wireish+=1;
    else if(refLike(f[0]))xrefish+=1;
  }
  if(wireish>=xrefish&&wireish>0)return"mswire";
  if(xrefish>0)return"msxref";
  if(/(?:^|\n)\s*[.*/]/.test(s)&&/(?:^|\n)\s*[RCLDQXUIVEF]\w*\s+\S+\s+\S+/.test(s))return"spice";
  return"text";
}
function __lcMSCacheStore(wireResults){
  var cache=window.__lcMSPinCache||(window.__lcMSPinCache=new Map);
  wireResults.forEach(function(w){
    w.refs.forEach(function(set,ref){cache.set(ref,__lcMSRenumber(set))});
  });
  return cache;
}
function __lcMSBuild(wireResults,xrefResults){
  var cache=__lcMSCacheStore(wireResults);
  var comps=[],byRef=new Map,ignored=0;
  xrefResults.forEach(function(x){
    ignored+=x.ignored;
    x.comps.forEach(function(cp){
      var hit=byRef.get(cp.ref);
      if(hit){if(!hit.value)hit.value=cp.value;if(!hit.category)hit.category=cp.category;if(hit.pkg==="-"&&cp.pkg!=="-")hit.pkg=cp.pkg;return}
      byRef.set(cp.ref,cp);comps.push(cp);
    });
  });
  var groups=new Map;
  comps.forEach(function(cp){
    var pre=(cp.ref.match(/^[A-Z]+/)||[""])[0];
    var cat=__lcMSVocab(cp.ref,cp.value,cp.category,cp.pkg);
    var n=void 0;
    var cset=cache.get(cp.ref);
    if(cset&&cset.size>0)n=cset.size;
    if(n===void 0)n=__lcMSPkgPins(cp.pkg,pre);
    var def=__lcMSDefPins[cat]!==void 0?__lcMSDefPins[cat]:2;
    if(n===void 0)n=def;
    var base=cat;
    var part;
    if(cat==="Connector_Generic:Conn")part="Conn_01x"+(n<10?"0"+n:String(n));
    else if(cat==="Socket:DIP")part=n===8?"DIP":"DIP"+n;
    else if(cat==="Switch:SW_DIP")part="SW_DIP_x"+Math.max(1,Math.floor(n/2));
    else if(cat==="Display_Character:7SEG")part=n===10?"7SEG":"7SEG"+n;
    else if(cat==="Display_Character:ALNUM")part=n===18?"ALNUM":"ALNUM"+n;
    else if(cat==="TerminalBlock:TerminalBlock")part="TerminalBlock_01x0"+n;
    else part=n===def?base.split(":")[1]:base.split(":")[1]+n;
    var key=cat.split(":")[0]+":"+part;
    cp.cat=key;
    var g=groups.get(key);
    if(!g){g={lib:cat.split(":")[0],part:part,pins:n};groups.set(key,g)}
    if(n>g.pins)g.pins=n;
  });
  var esc=__lcEsc;
  var out=['(export (version "E")','  (design (source "multisim-reports") (date "'+new Date().toISOString().slice(0,10)+'") (tool "multisim-report"))'];
  out.push("  (components");
  comps.forEach(function(cp){
    out.push('    (comp (ref "'+esc(cp.ref)+'") (value "'+esc(cp.value)+'") (footprint "'+esc(cp.pkg)+"\")");
    out.push('      (fields (field (name "Footprint") "'+esc(cp.pkg)+'"))');
    out.push('      (libsource (lib "'+esc(cp.cat.split(":")[0])+'") (part "'+esc(cp.cat.split(":")[1])+'") (description "")))');
  });
  out.push("  )");
  out.push("  (libparts");
  groups.forEach(function(g,key){
    out.push('    (libpart (lib "'+esc(g.lib)+'") (part "'+esc(g.part)+'")');
    out.push("      (pins");
    for(var p=1;p<=g.pins;p+=1)out.push('        (pin (num "'+p+'") (name "'+p+'") (type "passive"))');
    out.push("      )");
    out.push("    )");
  });
  out.push("  )");
  out.push("  (nets");
  var code=0,nodeCount=0;
  wireResults.forEach(function(w){
    w.nets.forEach(function(nodes,netName){
      code+=1;
      out.push('    (net (code "'+code+'") (name "'+esc(netName)+'")');
      nodes.forEach(function(nd){
        var m=cache.get(nd.ref);
        var num=m&&m.get(nd.pin);
        if(num===void 0)return;
        out.push('      (node (ref "'+esc(nd.ref)+'") (pin "'+num+'"))');
        nodeCount+=1;
      });
      out.push("    )");
    });
  });
  out.push("  )");
  out.push(")");
  var warnings=[];
  if(ignored>0)warnings.push({fileName:"multisim",message:"已忽略 "+ignored+" 个电源 / 地符号（POWER / GROUND / VCC 等，不参与布局）。"});
  var dropped=0;
  wireResults.forEach(function(w){w.rows>0&&(dropped+=w.rows)});
  if(dropped>0&&nodeCount===0)warnings.push({fileName:"multisim",message:"连线表已读取但没有任何有效引脚：请确认 Cross Reference 报告与 Wire List 来自同一个 Multisim 工程。"});
  return{sexpr:out.join("\n"),warnings:warnings,comps:comps.length,nets:code};
}
async function __lcImportBatch(files){
  var t={components:[],nets:[],pinInfo:{},warnings:[]};
  var wires=[],xrefs=[],plain=[];
  for(var i=0;i<files.length;i+=1){
    var f=files[i];
    var text=await f.text();
    var kind=__lcSniff(text);
    if(kind==="mswire")wires.push(__lcMSWireParse(text,f.name));
    else if(kind==="msxref")xrefs.push(__lcMSXRefParse(text,f.name));
    else if(kind==="spice")t.warnings.push({fileName:f.name,message:"检测到 SPICE 网表（.cir）。本软件读取 Multisim 的 Wire List 与 Cross Reference 报告（Tools → Report 菜单导出 txt / csv），不支持 SPICE 网表。"});
    else plain.push({text:text,name:f.name,kind:kind});
  }
  if(wires.length>0||xrefs.length>0){
    var built=__lcMSBuild(wires,xrefs);
    t4(t,e4(built.sexpr,"multisim-reports"));
    t.warnings.push(...built.warnings);
    if(built.nets>0&&built.comps===0)t.warnings.push({fileName:"multisim",message:"已解析连线表，但缺少元件报告：请同时导入 Multisim 的 Cross Reference Report（交叉引用报告）才能生成元件。"});
  }
  for(var j=0;j<plain.length;j+=1){
    var p=plain[j];
    var s=p.kind==="protel"?__lcProtel(p.text):p.text;
    t4(t,e4(s,p.name));
  }
  return t;
}
