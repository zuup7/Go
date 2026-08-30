# -*- coding: utf-8 -*-
"""learn.html · monsters.html · index.html 을 한 파일(hansa.html)로 합친다.

세 앱은 전역 이름·CSS 클래스·정적 id 가 겹친다. 그래서
  · CSS 는 앱마다 .a-learn / .a-mon / .a-sprint 아래로 밀어 넣고 (:root 변수 포함)
  · JS 는 통째로 IIFE 로 감싸 전역을 막고
  · 겹치는 정적 id 는 앞에 L / M / S 를 붙이고
  · 쉬지 않는 앱은 DOM 에서 떼어 둔다 (getElementById 가 못 찾게)
"""
import io, re, sys

SRC = "/home/user/Go/"

def read(p):
    return io.open(SRC + p, encoding="utf-8").read()

def split(html):
    styles  = re.findall(r"<style>(.*?)</style>", html, re.S)
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    body = re.sub(r"<style>.*?</style>", "", html, flags=re.S)
    body = re.sub(r"<script>.*?</script>", "", body, flags=re.S)
    body = re.sub(r"<title>.*?</title>|<meta[^>]*>|<link[^>]*>", "", body, flags=re.S)
    return styles, scripts, body.strip()

# ── CSS 를 한 클래스 아래로 밀어 넣기 ──────────────────────────────
DROP_TOP = {"*", "html", "body", "html,body", ":focus-visible", "button"}

def scope_selector(sel, root):
    sel = sel.strip()
    if not sel:
        return sel
    if sel == ":root":
        return root
    if sel in ("html", "body", "html,body"):
        return root
    if sel.startswith("@"):
        return sel
    if sel == "*":
        return root + " *"
    # .a-mon 자신에게도 걸려야 하는 규칙(.win 처럼)은 자손 선택자로 충분하다
    return root + " " + sel

def scope_block(css, root):
    """최상위 규칙만 훑어 선택자에 root 를 붙인다. @media/@supports 는 안으로 들어간다."""
    out = []
    i, n = 0, len(css)
    while i < n:
        # 주석
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append(css[i:j]); i = j; continue
        if css[i] in " \t\r\n":
            out.append(css[i]); i += 1; continue
        # 선택자 ~ '{'
        j = css.find("{", i)
        if j < 0:
            out.append(css[i:]); break
        sel = css[i:j].strip()
        # 블록 끝 찾기
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        inner = css[j + 1:k - 1]
        if sel.startswith("@keyframes") or sel.startswith("@-webkit-keyframes"):
            out.append(sel + "{" + inner + "}")
        elif sel.startswith("@media") or sel.startswith("@supports"):
            out.append(sel + "{" + scope_block(inner, root) + "}")
        elif sel.startswith("@"):
            out.append(sel + "{" + inner + "}")
        else:
            sels = [s for s in (x.strip() for x in sel.split(",")) if s]
            if len(sels) == 1 and sels[0] in DROP_TOP:
                # 전역 규칙은 셸이 한 번만 깐다
                if sels[0] in (":root", "body"):
                    # body 의 글자색·서체는 앱 뿌리로 옮긴다. 안 옮기면 셸 색을 물려받아 흐려진다
                    out.append(root + "{" + inner + "}")
                elif sels[0] in ("html", "html,body"):
                    pass
                else:
                    out.append(scope_selector(sels[0], root) + "{" + inner + "}")
            else:
                keep = [s for s in sels if s not in ("html", "body")]
                if keep:
                    out.append(",".join(scope_selector(s, root) for s in keep) + "{" + inner + "}")
        i = k
    return "".join(out)

# ── learn ─────────────────────────────────────────────────────────
Ls, Lj, Lbody = split(read("learn.html"))
Ms, Mj, Mbody = split(read("monsters.html"))
Is, Ij, Ibody = split(read("index.html"))
assert len(Lj) == 1 and len(Mj) >= 1 and len(Ij) >= 1, (len(Lj), len(Mj), len(Ij))

L_IDS = {"app": "Lapp", "back": "Lback", "title": "Ltitle", "view": "Lview",
         "dock": "Ldock", "find": "Lfind", "theme": "Ltheme", "clk": "Lclk"}
M_IDS = {"app": "Mapp", "back": "Mback", "title": "Mtitle", "view": "Mview",
         "barExtra": "Mextra", "flash": "Mflash", "mfLink": "MmfLink", "clk": "Mclk"}
# 스프린트는 뿌리에 id 가 없어 우리가 하나 달아 준다 (셸이 떼었다 붙일 손잡이)
I_IDS = {"clk": "Sclk", "winTtl": "SwinTtl", "cDday": "ScDday", "cStrk": "ScStrk",
         "ringArc": "SringArc", "ringTx": "SringTx", "todayVal": "StodayVal",
         "rankTx": "SrankTx", "xpFill": "SxpFill", "stage": "Sstage", "nav": "Snav",
         "mastery": "Smastery", "railPick": "SrailPick"}

def rename_ids(text, table):
    for a, b in table.items():
        text = text.replace('id="%s"' % a, 'id="%s"' % b)
        text = text.replace('getElementById("%s")' % a, 'getElementById("%s")' % b)
        # querySelector("#cStrk .n") 처럼 선택자 문자열에 박힌 것도 같이 바꾼다
        text = text.replace('"#%s"' % a, '"#%s"' % b)
        text = text.replace('"#%s ' % a, '"#%s ' % b)
    return text

Lbody = rename_ids(Lbody, L_IDS); Ljs = rename_ids(Lj[0], L_IDS)
Mbody = rename_ids(Mbody, M_IDS); Mjs = "\n".join(rename_ids(x, M_IDS) for x in Mj)
Ibody = rename_ids(Ibody, I_IDS); Ijs = "\n".join(rename_ids(x, I_IDS) for x in Ij)

# 앱마다 붙어 있던 OS 표시줄은 셸이 대신한다
def strip_osbar(body):
    out = re.sub(r'<div class="osbar">.*?</div>\s*(?=<div)', "", body, flags=re.S, count=1)
    assert 'class="osbar"' not in out, "osbar 제거 실패"
    return out.strip()
Lbody = strip_osbar(Lbody); Mbody = strip_osbar(Mbody); Ibody = strip_osbar(Ibody)

# 쉬는 앱은 뒤로가기·단축키에 반응하면 안 된다
Ljs = Ljs.replace(
    'window.addEventListener("popstate",function(){',
    'window.addEventListener("popstate",function(){\n  if(window.__hansa!=="learn")return;', 1)
Ljs = Ljs.replace(
    '  document.addEventListener("keydown",function(e){',
    '  document.addEventListener("keydown",function(e){\n    if(window.__hansa!=="learn")return;', 1)
assert '__hansa!=="learn"' in Ljs and Ljs.count('__hansa!=="learn"') == 2
Mjs = Mjs.replace(
    'window.addEventListener("popstate",function(){ if(stack.length>1)',
    'window.addEventListener("popstate",function(){ if(window.__hansa!=="mon")return; if(stack.length>1)', 1)
assert '__hansa!=="mon"' in Mjs

# ── 합쳐 놓았으니 앱끼리 오갈 수 있어야 한다 ──────────────────────
L_LINK_OLD = ("""    '<p class="note" style="margin-top:14px">배운 내용을 문제로 확인하고 싶으면 """
              """\u300c오답 몬스터\u300d로 넘어가면 돼. 여긴 처음 배우는 곳이야.</p>';""")
L_LINK_NEW = ("""    '<div class="part">다른 앱으로</div>'+
    '<button class="cta ghost" data-hansa-go="mon">\u25b6 오답 몬스터 열기</button>'+
    '<button class="cta ghost" data-hansa-go="sprint" style="margin-top:9px">\u25b6 연표 스프린트 열기</button>'+
    '<p class="note" style="margin-top:10px">여긴 처음 배우는 곳이야. 배운 내용을 문제로 확인하고 싶으면 몬스터, 순서만 빠르게 돌리고 싶으면 스프린트로 넘어가면 돼.</p>';""")
assert Ljs.count(L_LINK_OLD) == 1, "첫 수업 안내 문구를 못 찾음"
Ljs = Ljs.replace(L_LINK_OLD, L_LINK_NEW)

M_LINK_OLD = """      UNITS.length+'개 · 문제 '+QUESTIONS.length+'개</p>';"""
M_LINK_NEW = ("""      UNITS.length+'개 · 문제 '+QUESTIONS.length+'개</p>'+
    '<div class="sect">모르는 게 나오면</div>'+
    '<button class="mode" data-hansa-go="learn" style="width:100%"><span class="ic" style="background:rgba(245,198,60,.16);color:var(--amber)">'+ICON.mc+'</span>'+
    '<span><b>한국사 첫 수업</b><small>개념부터 다시. 스무 번에 나눠 담은 교과서 \u2160단원.</small></span>'+
    '<span class="cnt">\u203a</span></button>'+
    '<button class="mode" data-hansa-go="sprint" style="width:100%"><span class="ic" style="background:rgba(72,211,172,.16);color:var(--jade)">'+ICON.tl+'</span>'+
    '<span><b>연표 스프린트</b><small>순서만 빠르게. 플래시카드와 연표 정렬.</small></span>'+
    '<span class="cnt">\u203a</span></button>';""")
assert Mjs.count(M_LINK_OLD) == 1, "몬스터 범위 문구를 못 찾음"
Mjs = Mjs.replace(M_LINK_OLD, M_LINK_NEW, 1)

# 표시줄에서 켜져 있는 앱을 다시 누르면 그 앱의 홈으로 — 독 아이콘과 같은 감각
Ljs += """
\n/* 셸이 부를 수 있게 홈으로 가는 길을 하나 내어 둔다 */
window.__hansaHome=window.__hansaHome||{};
window.__hansaHome.learn=function(){ L=null; stack=[{n:"home"}]; render(); };
"""
Mjs += """
\n/* 셸이 부를 수 있게 홈으로 가는 길을 하나 내어 둔다 */
window.__hansaHome=window.__hansaHome||{};
window.__hansaHome.mon=function(){ stopAll(); G=null; stack=[{n:"home"}]; render(); };

/* 앱을 갈아 끼우면 시계를 멈춰 둔다.
   안 멈추면 다른 앱을 보는 동안 60초가 다 흘러 판이 혼자 끝나 버린다 */
window.__hansaPause=window.__hansaPause||{};
window.__hansaResume=window.__hansaResume||{};
window.__hansaPause.mon=function(){
  if(tickTimer){clearInterval(tickTimer);tickTimer=null;}
  if(pairTimer){clearInterval(pairTimer);pairTimer=null;}
  if(duelTimer){clearInterval(duelTimer);duelTimer=null;}
  if(P&&!P.over)P.away=Date.now();      /* 짝 맞추기는 흐른 시간을 재니 떠난 때를 적어 둔다 */
  speakStop();
};
window.__hansaResume.mon=function(){
  var n=stack[stack.length-1].n;
  if(n==="play"&&G&&G.mode==="ox"&&G.left>0)runClock();
  if(n==="pair"&&P&&!P.over){
    if(P.away){P.t0+=Date.now()-P.away;P.away=0;}
    runPairTimer();
  }
  if(n==="first"&&F&&!F.over&&F.left>0)runDuelTimer();
};
"""

I_LINK_OLD = """    '<div class="sect">출제 범위</div>'+"""
I_LINK_NEW = ("""    '<div class="sect">다른 앱으로</div>'+
    '<div class="tlsw" style="margin-bottom:14px">'+
      '<button class="btn ghost" data-hansa-go="learn">첫 수업</button>'+
      '<button class="btn ghost" data-hansa-go="mon">오답 몬스터</button>'+
    '</div>'+
    '<div class="sect">출제 범위</div>'+""")
assert Ijs.count(I_LINK_OLD) == 1, "스프린트 「출제 범위」 앞자리를 못 찾음"
Ijs = Ijs.replace(I_LINK_OLD, I_LINK_NEW, 1)

Ijs += """
\n/* 셸이 부를 수 있게 홈으로 가는 길을 하나 내어 둔다 */
window.__hansaHome=window.__hansaHome||{};
window.__hansaHome.sprint=function(){ go("today"); };
"""

def rename_css_ids(css, table):
    """CSS 안의 #app 같은 id 선택자도 함께 바꾼다. 안 바꾸면 규칙이 통째로 안 걸린다."""
    for a, b in table.items():
        css = re.sub(r"#%s\b" % re.escape(a), "#" + b, css)
    return css

Lcss = rename_css_ids(scope_block("\n".join(Ls), ".a-learn"), L_IDS)
Mcss = rename_css_ids(scope_block("\n".join(Ms), ".a-mon"), M_IDS)
Icss = rename_css_ids(scope_block("\n".join(Is), ".a-sprint"), I_IDS)

SHELL_CSS = """
/* ══════════════════════════════════════════════════════════════
   HANSA OS — 세 앱이 한 데스크톱 위에서 돌아간다.
   위쪽 작업 표시줄로 앱을 갈아 끼우고, 쉬는 앱은 DOM 에서 떼어 둔다.
   ══════════════════════════════════════════════════════════════ */
:root{
  --desk:#6E5A7D; --desk-d:#4A3B57; --desk-l:#8A7399;
  --cream:#FBF3E2; --panel:#F2E5C9; --panel-d:#E3D2AE;
  --ink:#2B1F33; --yel:#F5C63C; --yel-d:#C89A18; --red:#D2453B;
  --f-px:"Press Start 2P","Courier New",monospace;
  --f-h:"Do Hyeon","Gothic A1",sans-serif;
  --f-b:"Gothic A1","Apple SD Gothic Neo",system-ui,sans-serif;
  --bd:3px; --sh:4px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;
  border-radius:0!important;image-rendering:pixelated}
html,body{height:100%}
body{
  background:var(--desk);
  background-image:
    repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 2px,transparent 2px 4px),
    linear-gradient(160deg,var(--desk-l) 0%,var(--desk) 45%,var(--desk-d) 100%);
  background-attachment:fixed;
  color:var(--ink);font-family:var(--f-b);font-size:16px;line-height:1.7;
  word-break:keep-all;overscroll-behavior-y:none;
}
button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;font-family:var(--f-b)}
:focus-visible{outline:3px solid var(--yel);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

/* ── 작업 표시줄 ── */
.osbar{position:sticky;top:0;z-index:70;background:var(--ink);color:var(--cream);
  display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:var(--bd) solid #150E1B;
  font-family:var(--f-px);font-size:9px;letter-spacing:.04em}
.osbar .logo{display:inline-flex;gap:2px;flex-shrink:0;margin-right:2px}
.osbar .logo i{width:4px;height:12px;display:block;transform:skewX(-18deg)}
.osbar .clk{flex-shrink:0;color:var(--yel);margin-left:auto}
@media(max-width:520px){.osbar .clk{display:none}}
.tsk{display:flex;gap:6px;min-width:0;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.tsk::-webkit-scrollbar{display:none}
.tb{position:relative;display:inline-flex;align-items:center;gap:7px;min-height:34px;
  padding:5px 10px 5px 6px;background:var(--panel);color:var(--ink);border:2px solid #150E1B;
  box-shadow:inset -2px -2px 0 var(--panel-d),inset 2px 2px 0 #fff;
  font-family:var(--f-h);font-size:14px;white-space:nowrap}
.tb:active{box-shadow:inset 2px 2px 0 var(--panel-d);transform:translate(1px,1px)}
.tb[aria-current="true"]{background:var(--yel);
  box-shadow:inset -2px -2px 0 var(--yel-d),inset 2px 2px 0 #FFF0B8}
.tb .ic{width:22px;height:22px;flex-shrink:0;display:grid;place-items:center}
@media(max-width:400px){.tb{font-size:12.5px;padding:5px 8px 5px 5px;gap:5px}}
.tb .bdg{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;background:var(--red);
  border:2px solid #150E1B;color:#fff;font-family:var(--f-px);font-size:7px;
  display:grid;place-items:center;padding:0 2px;line-height:1}
.pane[hidden]{display:none}
"""

SHELL_JS = r"""
/* ══════════════════════════════════════════════════════════════
   셸 — 앱 갈아 끼우기
   두 앱은 정적 id 만 다르고 화면 안에서 만드는 id 는 겹칠 수 있다.
   그래서 쉬는 앱의 뿌리를 DOM 에서 떼어 둔다 — getElementById 가 못 찾는다.
   요소 참조는 살아 있으므로 다시 붙이면 그대로 이어진다.
   ══════════════════════════════════════════════════════════════ */
(function(){
  var HOLD={}, SLOT={};
  var APPS=[
    {k:"learn",el:document.getElementById("Lapp"),n:"첫 수업",
     ic:'<svg width="22" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="2" width="12" height="12" fill="#2B1F33"/><rect x="3" y="3" width="10" height="10" fill="#FBF3E2"/><rect x="7" y="3" width="2" height="10" fill="#2B1F33"/><rect x="4" y="5" width="3" height="1" fill="#2B1F33"/><rect x="9" y="5" width="3" height="1" fill="#2B1F33"/><rect x="4" y="7" width="3" height="1" fill="#2B1F33"/><rect x="9" y="7" width="3" height="1" fill="#2B1F33"/></svg>',
     key:"hansa-learn-v1"},
    {k:"mon",el:document.getElementById("Mapp"),n:"몬스터",
     ic:'<svg width="22" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="2" width="10" height="11" fill="#2B1F33"/><rect x="4" y="3" width="8" height="9" fill="#B79EEC"/><rect x="5" y="6" width="2" height="3" fill="#2B1F33"/><rect x="9" y="6" width="2" height="3" fill="#2B1F33"/><rect x="3" y="13" width="2" height="1" fill="#2B1F33"/><rect x="7" y="13" width="2" height="1" fill="#2B1F33"/><rect x="11" y="13" width="2" height="1" fill="#2B1F33"/></svg>',
     key:"hansa-monster-v1"},
    {k:"sprint",el:document.getElementById("Sapp"),n:"연표",
     ic:'<svg width="22" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="2" width="12" height="12" fill="#2B1F33"/><rect x="3" y="3" width="10" height="10" fill="#FBF3E2"/><rect x="3" y="3" width="10" height="2" fill="#E0812C"/><rect x="5" y="7" width="6" height="1" fill="#2B1F33"/><rect x="5" y="9" width="6" height="1" fill="#2B1F33"/><rect x="5" y="11" width="4" height="1" fill="#2B1F33"/></svg>',
     key:"hansa-sprint-v2"}
  ];
  APPS.forEach(function(a){
    SLOT[a.k]=document.createComment("app:"+a.k);
    a.el.parentNode.insertBefore(SLOT[a.k],a.el);
  });

  function badge(a){
    try{
      var S=JSON.parse(localStorage.getItem(a.key)||"{}");
      if(a.k==="learn"){
        var w=Object.keys(S.wrong||{}).length;
        var due=0,t=Math.floor(Date.now()/864e5);
        Object.keys(S.due||{}).forEach(function(id){ if(S.done&&S.done[id]&&S.due[id].at<=t)due++; });
        return w+due;
      }
      if(a.k==="sprint")return (S.wrong||[]).length;
      return Object.keys(S.monsters||{}).length;
    }catch(e){ return 0; }
  }

  var bar=document.getElementById("tsk");
  function paint(){
    bar.innerHTML=APPS.map(function(a){
      var n=badge(a);
      return '<button class="tb" data-k="'+a.k+'" aria-current="'+(window.__hansa===a.k)+'">'+
        '<span class="ic">'+a.ic+'</span>'+a.n+
        (n?'<span class="bdg">'+(n>99?"99":n)+'</span>':'')+'</button>';
    }).join("");
    Array.prototype.forEach.call(bar.querySelectorAll(".tb"),function(b){
      b.onclick=function(){ switchTo(b.dataset.k); };
    });
  }

  function switchTo(k){
    if(window.__hansa===k){
      /* 켜져 있는 앱을 다시 누르면 그 앱의 홈으로 */
      try{ window.__hansaHome&&window.__hansaHome[k]&&window.__hansaHome[k](); }catch(e){}
      window.scrollTo(0,0); paint(); return;
    }
    var prev=window.__hansa;
    if(prev){ try{ window.__hansaPause&&window.__hansaPause[prev]&&window.__hansaPause[prev](); }catch(e){} }
    window.__hansa=k;
    APPS.forEach(function(a){
      if(a.k===k){
        if(!a.el.parentNode)SLOT[a.k].parentNode.insertBefore(a.el,SLOT[a.k].nextSibling);
      }else if(a.el.parentNode){
        HOLD[a.k]=a.el; a.el.parentNode.removeChild(a.el);
      }
    });
    try{ localStorage.setItem("hansa-app",k); }catch(e){}
    try{ window.__hansaResume&&window.__hansaResume[k]&&window.__hansaResume[k](); }catch(e){}
    paint(); window.scrollTo(0,0);
  }
  window.__hansaSwitch=switchTo;
  /* 앱 안에 심어 둔 [data-hansa-go] 단추 — 어느 화면에서 눌러도 통한다 */
  document.addEventListener("click",function(e){
    var t=e.target,b=t&&t.closest&&t.closest("[data-hansa-go]");
    if(b){ e.preventDefault(); switchTo(b.getAttribute("data-hansa-go")); }
  });
  /* 앱 안에서 배지 숫자가 바뀌면 표시줄도 따라간다 */
  window.__hansaPaint=paint;
  setInterval(paint,4000);

  var DOW=["SUN","MON","TUE","WED","THU","FRI","SAT"];
  function tick(){
    var d=new Date(),h=d.getHours(),ap=h<12?"AM":"PM",hh=h%12||12;
    document.getElementById("clk").textContent=DOW[d.getDay()]+" "+
      String(hh).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")+ap+" "+d.getFullYear();
  }
  tick(); setInterval(tick,20000);

  var last="learn";
  try{ last=localStorage.getItem("hansa-app")||"learn"; }catch(e){}
  window.__hansa=null;
  switchTo(APPS.some(function(a){return a.k===last;})?last:"learn");
})();
"""

HEAD = """<title>한국사 기말 — HANSA OS</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2B1F33">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="한국사 기말">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="fontCss" rel="stylesheet" media="print" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Do+Hyeon&family=Gothic+A1:wght@400;500;700;800;900&display=swap">
"""

TASKBAR = """<div class="osbar">
  <span class="logo"><i style="background:#D2453B"></i><i style="background:#F5C63C"></i><i style="background:#2F8C7E"></i></span>
  <span class="tsk" id="tsk"></span>
  <span class="clk" id="clk">--- --:-- 1985</span>
</div>
"""

out = []
out.append(HEAD)
out.append("<style>" + SHELL_CSS + "</style>\n")
out.append(TASKBAR)
out.append('<div class="a-learn pane" id="Lapp-wrap">\n' + Lbody + "\n</div>\n")
out.append('<div class="a-mon pane" id="Mapp-wrap">\n' + Mbody + "\n</div>\n")
out.append('<div class="a-sprint pane" id="Sapp">\n' + Ibody + "\n</div>\n")
out.append("<style>\n/* ── 「한국사 첫 수업」 ── */\n" + Lcss + "\n</style>\n")
out.append("<style>\n/* ── 「오답 몬스터」 ── */\n" + Mcss + "\n</style>\n")
out.append("<style>\n/* ── 「연표 스프린트」 ── */\n" + Icss + "\n</style>\n")
out.append("<script>\n/* ══ 「한국사 첫 수업」 ══ */\n(function(){\n" + Ljs + "\n})();\n</script>\n")
out.append("<script>\n/* ══ 「오답 몬스터」 ══ */\n(function(){\n" + Mjs + "\n})();\n</script>\n")
out.append("<script>\n/* ══ 「연표 스프린트」 ══ */\n(function(){\n" + Ijs + "\n})();\n</script>\n")
out.append("<script>" + SHELL_JS + "</script>\n")

io.open(SRC + "hansa.html", "w", encoding="utf-8").write("".join(out))
print("hansa.html 만듦")
