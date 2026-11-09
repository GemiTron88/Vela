import {reviewRenderedMedia} from './asset-strategy.mjs';
// Executed inside the live page. Never substitute a source-code approximation.
export function collectWebGeometry(){
  const viewport={width:innerWidth,height:innerHeight},all=[...document.body.querySelectorAll('*')],visible=[];
  const modal=[...document.querySelectorAll('[aria-modal="true"],dialog[open]')].find(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0;});let hitTests=0,hitTestComplete=true;
  for(const el of all){const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(!r.width||!r.height||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
    const tag=el.tagName.toLowerCase(),interactive=el.matches('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=menuitem]');
    const parent=el.parentElement,ps=parent?getComputedStyle(parent):null,pr=parent?.getBoundingClientRect();
    const box=x=>x?{x:x.x,y:x.y,width:x.width,height:x.height}:null;
    const padding=x=>['Top','Right','Bottom','Left'].map(k=>parseFloat(x?.['padding'+k])||0);
    const textNodes=[...el.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim();
    const ownText=textNodes||(tag==='input'||tag==='textarea'?String(el.value||el.placeholder||'').trim():'');
    let hitTest=null;
    if(interactive&&r.x<innerWidth&&r.x+r.width>0&&r.y<innerHeight&&r.y+r.height>0&&!el.disabled&&s.pointerEvents!=='none'&&!el.closest('[inert],[aria-hidden="true"],[aria-disabled="true"]')&&(!modal||modal.contains(el))){
      if(hitTests++>=100)hitTestComplete=false;
      else{
        const left=Math.max(0,r.x),top=Math.max(0,r.y),width=Math.min(innerWidth,r.x+r.width)-left,height=Math.min(innerHeight,r.y+r.height)-top;
        const hits=[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]].map(([x,y])=>document.elementFromPoint(left+x*width,top+y*height));
        const blocked=hit=>Boolean(hit&&!el.contains(hit)&&!hit.contains(el));
        hitTest={samples:5,covered:hits.filter(blocked).length,centerCovered:blocked(hits[0])};
      }
    }
    const iconControl=tag==='svg'&&Boolean(el.closest('button,[role="button"]')||el.getAttribute('aria-hidden')==='true'&&el.closest('a[href]'));
    // Detect genuinely rendered fixed multi-action contact bars; no assumed CSS class names.
    const bottomLinks=s.position==='fixed'&&r.y>innerHeight*.4?[...el.querySelectorAll('a[href]')].slice(0,6):[];
    const fixedBottomActionBar=el.hasAttribute('data-visual-bottom-cta')&&s.position==='fixed'||s.position==='fixed'&&bottomLinks.length>=2&&bottomLinks.some(a=>/^(?:tel:|https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/)/i.test(a.getAttribute('href')??''));
    const bottomGap=fixedBottomActionBar?Math.round((innerHeight-(r.y+r.height))*10)/10:null;
    let effectiveBg=s.backgroundColor,anc=el.parentElement;
    while(anc&&(!effectiveBg||effectiveBg==='transparent'||/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/i.test(effectiveBg))){effectiveBg=getComputedStyle(anc).backgroundColor;anc=anc.parentElement;}
    visible.push({id:el.id||`node-${visible.length}`,tag,role:el.getAttribute('role'),interactive,critical:el.hasAttribute('data-visual-critical'),rect:box(r),parentRect:box(pr),padding:padding(s),parentPadding:padding(ps),margin:['Top','Right','Bottom','Left'].map(k=>parseFloat(s['margin'+k])||0),parentMargin:['Top','Right','Bottom','Left'].map(k=>parseFloat(ps?.['margin'+k])||0),spacingIntent:el.getAttribute('data-visual-spacing-intent'),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflowX:s.overflowX,overflowY:s.overflowY,textOverflow:s.textOverflow,whiteSpace:s.whiteSpace,ownText:ownText.length,translationKey:/^[a-z][a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/i.test(ownText)?ownText:null,fontFamily:s.fontFamily,fontWeight:s.fontWeight,fontStyle:s.fontStyle,fontSize:parseFloat(s.fontSize),iconControl,hitTest,fixedBottomActionBar,bottomGap,mediaBackground:/(?:url\(|image-set\()/i.test(s.backgroundImage??''),color:s.color,backgroundColor:effectiveBg||s.backgroundColor,borderRadius:s.borderRadius,zIndex:s.zIndex,position:s.position});
    if(visible.length>=1500)break;
  }
  const images=[...document.images].map(i=>({complete:i.complete,naturalWidth:i.naturalWidth,placeholder:/placeholder|dummy|via\.placeholder|\/sample[-_.]/i.test(i.currentSrc||i.src),rect:{width:i.width,height:i.height}}));
  const assetUrls=[...document.images].map(el=>el.currentSrc||el.src).concat([...document.scripts].map(el=>el.src),[...document.querySelectorAll('link[rel="stylesheet"],link[rel="preload"],link[rel="modulepreload"],link[rel~="icon"]')].map(el=>el.href),performance.getEntriesByType('resource').filter(entry=>['img','css','script','link'].includes(entry.initiatorType)||/\.(?:js|css|woff2?|wasm)(?:[?#]|$)/.test(entry.name)).map(entry=>entry.name));
  const assetOrigins=[...new Set(assetUrls.filter(Boolean).map(url=>{try{return /^data:|^blob:/.test(url)?'embedded-local':new URL(url,location.href).origin;}catch{return 'invalid';}}))];
  const visibleKeyCandidates=visible.map(node=>node.translationKey).filter(Boolean).slice(0,100);
  const active=sheet=>!sheet.disabled&&(!sheet.media?.mediaText||matchMedia(sheet.media.mediaText).matches);
  const sheets=[...document.styleSheets].filter(active);let unreadableStylesheets=0;
  const stylesheetRules=sheets.reduce((total,sheet)=>{try{return total+sheet.cssRules.length;}catch{unreadableStylesheets++;return total;}},0);
  const failedStylesheets=[...document.querySelectorAll('link[rel~="stylesheet"]')].filter(link=>!link.disabled&&(!link.media||matchMedia(link.media).matches)&&!link.sheet).length;
  const presentation={schemaVersion:1,stylesheetRules,failedStylesheets,unreadableStylesheets,inlineStyleCount:all.filter(el=>el.style?.length>0).length,fontSetStatus:document.fonts.status,fontFaces:[...document.fonts].slice(0,300).map(font=>({family:font.family,status:font.status,weight:font.weight,style:font.style})),complete:document.fonts.size<=300&&hitTestComplete};
  return {schemaVersion:'executionkit-visual-geometry/v2',platform:'web',viewport,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,complete:visible.length<1500,nodes:visible,images,presentation,assetOrigins,pageOrigin:location.origin,visibleKeyCandidates,htmlLocale:document.documentElement.lang,htmlDirection:getComputedStyle(document.documentElement).direction,colorScheme:getComputedStyle(document.documentElement).colorScheme,theme:document.documentElement.dataset.theme??null,title:document.title,controlInventory:visible.filter(n=>n.interactive).map(n=>({id:n.id,tag:n.tag,role:n.role,critical:n.critical}))};
}
function luminance(rgb){return rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
function parseColor(s,backdrop=[255,255,255]){const m=/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(s??'');if(!m)return null;const alpha=m[4]===undefined?1:Number(m[4]);if(!Number.isFinite(alpha)||alpha<=0)return null;const rgb=m.slice(1,4).map(Number);return alpha>=1?rgb:rgb.map((c,i)=>Math.round(c*alpha+(backdrop[i]??255)*(1-alpha)));}
export function analyzeVisualGeometry(g,{compact=false,spacingTokens=[],translationKeys=[]}={}){
  const findings=[],add=(category,severity,reason,node=null,extra={})=>findings.push({id:`geometry-${findings.length+1}`,category,severity,reason,observedEvidence:node?{node:node.id,rect:node.rect}:extra,recommendedRemediation:reason,acceptanceCriteria:'Recapture this state and verify the reported geometry and rendered quality.',...extra});
  if(g.platform!=='web'){
    for(const e of g.layoutExceptions??[])add(/RenderFlex|overflow/i.test(e)?'FLUTTER_LAYOUT_OVERFLOW':'FLUTTER_LAYOUT_EXCEPTION','P1',e);
    if(g.debugBanner)add('FLUTTER_DEBUG_BANNER','P1','Release evidence contains a Flutter debug banner.');
    return findings;
  }
  if(!g.complete)add('GEOMETRY_INCOMPLETE','P1','DOM analysis exceeded the bounded visible-node budget.');
  const p=g.presentation;
  if(!p||p.schemaVersion!==1||p.complete!==true||!Array.isArray(p.fontFaces)||!['stylesheetRules','failedStylesheets','unreadableStylesheets','inlineStyleCount'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0))add('PRESENTATION_OBSERVATION_REQUIRED','P1','Recapture live stylesheet, font and control hit-test observations; old source-only geometry is insufficient.');
  else{
    if(p.failedStylesheets>0)add('STYLESHEET_LOAD_FAILURE','P1','An active application stylesheet is missing from the rendered document.');
    if(p.unreadableStylesheets>0)add('STYLESHEET_OBSERVATION_INCOMPLETE','P1','Application stylesheet rules could not be inspected.');
    if(p.stylesheetRules===0&&p.inlineStyleCount===0)add('APPLICATION_STYLES_MISSING','P1','Rendered UI has no active author CSS rules or inline styling.');
    if(p.fontSetStatus!=='loaded')add('FONT_LOAD_INCOMPLETE','P1','Font loading has not completed; a fallback screenshot cannot certify typography.');
  }
  const family=value=>String(value??'').split(',')[0].trim().replace(/^["']|["']$/g,'').toLowerCase();
  const systemFonts=new Set(['system-ui','ui-sans-serif','ui-serif','ui-monospace','sans-serif','serif','monospace','cursive','fantasy','emoji','math','fangsong','-apple-system','blinkmacsystemfont','arial','helvetica','helvetica neue','tahoma','verdana','georgia','times new roman','courier new','trebuchet ms','segoe ui']),fontFindings=new Set();
  for(const origin of g.assetOrigins??[])if(origin!==g.pageOrigin&&origin!=='embedded-local')add('REMOTE_ASSET','P1','Rendered application loaded an asset from a remote origin.',null,{origin});
  if(g.documentWidth>g.viewport.width+2)add('HORIZONTAL_OVERFLOW','P1','Document exceeds the viewport width.',null,{overflowPixels:g.documentWidth-g.viewport.width});
  const tokenAllowed=value=>spacingTokens.includes(value);
  for(const suggestion of reviewRenderedMedia(g))add(suggestion.category,suggestion.severity,suggestion.reason,null,{mediaEvidence:suggestion.observedEvidence});
  if(compact){
    const header=g.nodes.find(n=>n.tag==='header'&&n.rect.y<g.viewport.height*.25);
    const main=g.nodes.find(n=>n.tag==='main');
    if(header&&main&&main.rect.y-(header.rect.y+header.rect.height)>Math.max(72,g.viewport.height*.09))add('HEADER_FIRST_FOLD_SPACING_REVIEW','review','Excessive gap between navigation and main content; independently assess visual rhythm and header balance.',header);
  }
  for(const n of g.nodes){const r=n.rect;
    if(n.fixedBottomActionBar&&compact){
      if(!Number.isFinite(n.bottomGap))add('FIXED_CTA_POSITION_UNVERIFIED','P1','Fixed contact action bar lacks a valid viewport anchor observation.',n);
      else if(n.bottomGap>48)add('FIXED_CTA_DETACHED_FROM_VIEWPORT','P1','Contact action bar is unexpectedly far above the bottom safe area, leaving a dead strip.',n,{bottomGap:n.bottomGap});
      else if(n.bottomGap< -8)add('FIXED_CTA_OFFSCREEN','P1','Fixed contact actions extend below the visible viewport.',n,{bottomGap:n.bottomGap});
    }
    if(n.hitTest?.centerCovered&&n.hitTest.covered>=3)add('OCCLUDED_CONTROL','P1','An unrelated overlay blocks the center and most sampled hit regions of this enabled action.',n);
    if(n.iconControl&&(r.width>Math.min(128,g.viewport.width*.4)||r.height>128))add('OVERSIZED_CONTROL_ICON','P1','A control icon occupies an excessive part of the viewport; verify CSS sizing and canonical component rendering.',n);
    if(n.ownText&&p?.fontFaces){
      const primary=family(n.fontFamily),faces=p.fontFaces.filter(font=>family(font.family)===primary);
      const weight=String(n.fontWeight??'400'),style=n.fontStyle??'normal';
      const key=primary+':'+weight+':'+style;
      const relevant=faces.filter(font=>{const bounds=String(font.weight==='normal'?'400':font.weight==='bold'?'700':font.weight).split(/\s+/).map(Number);return (bounds.length===2?Number(weight)>=bounds[0]&&Number(weight)<=bounds[1]:String(bounds[0])===weight)&&font.style===style;});
      if(!fontFindings.has(key)){
        if(relevant.length&&!relevant.some(font=>font.status==='loaded')){add('FONT_LOAD_FAILURE','P1','The declared primary font face for this rendered text failed or remains unloaded; fallback text is not accepted.',n);fontFindings.add(key);}
        else if(primary&&!faces.length&&!systemFonts.has(primary)){add('FONT_FAMILY_UNVERIFIED','review','A named primary font has no observed web-font face. Verify actual platform rendering against approved typography; CSS font-family alone does not prove availability.',n);fontFindings.add(key);}
      }
    }
    if(n.interactive&&(r.x<-2||r.x+r.width>g.viewport.width+2))add('OFFSCREEN_CONTROL',n.critical?'P1':'P2','An actionable control is outside the horizontal viewport.',n);
    if(compact&&n.interactive&&n.tag!=='input'&&(r.width<44||r.height<44))add('TINY_TOUCH_TARGET',n.critical?'P1':'P2','Touch action needs a 44px target or an explicit reviewed equivalent.',n);
    if(n.ownText&&n.scrollWidth>n.clientWidth+2&&['hidden','clip'].includes(n.overflowX))add('CLIPPED_TEXT','review','Text is clipped; inspect whether truncation has an accessible disclosure.',n);
    if(n.ownText&&n.scrollHeight>n.clientHeight+2&&['hidden','clip'].includes(n.overflowY))add('VERTICAL_TEXT_CLIP','review','Text extends beyond its clipped vertical container.',n);
    const insets=n.padding.map((v,i)=>v+(n.parentPadding?.[i]??0));
    if(insets.some((v,i)=>v>=56&&n.padding[i]>=24&&(n.parentPadding?.[i]??0)>=24&&!tokenAllowed(v))&&!n.spacingIntent)add('NESTED_PADDING_INFLATION','review','Parent and child padding create an unusually large effective inset.',n,{effectiveInsets:insets});
    if(n.margin.some((v,i)=>v>=24&&(n.parentMargin?.[i]??0)>=24&&v+(n.parentMargin?.[i]??0)>=64)&&!n.spacingIntent)add('NESTED_MARGIN_INFLATION','review','Nested margins may inflate spacing rhythm.',n);
    const fg=parseColor(n.color),bg=parseColor(n.backgroundColor);if(n.ownText&&fg&&bg){const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),threshold=n.fontSize>=24?3:4.5;if(ratio<threshold)add('LOW_TEXT_CONTRAST','P2','Measured text/background contrast is below the applicable threshold.',n,{contrastRatio:ratio});}
  }
  const actions=g.nodes.filter(n=>n.interactive&&n.rect.y<g.viewport.height&&n.rect.y+n.rect.height>0);
  const sameRect=(r1,r2)=>Boolean(r1&&r2&&Math.abs(r1.x-r2.x)<1&&Math.abs(r1.y-r2.y)<1&&Math.abs(r1.width-r2.width)<1&&Math.abs(r1.height-r2.height)<1);
  // Only flag unrelated actionable elements; containers intentionally overlap.
  for(let i=0;i<Math.min(actions.length,100);i++)for(let j=i+1;j<Math.min(actions.length,100);j++){const a=actions[i],b=actions[j];if(sameRect(a.parentRect,b.rect)||sameRect(b.parentRect,a.rect))continue;const w=Math.min(a.rect.x+a.rect.width,b.rect.x+b.rect.width)-Math.max(a.rect.x,b.rect.x),h=Math.min(a.rect.y+a.rect.height,b.rect.y+b.rect.height)-Math.max(a.rect.y,b.rect.y);if(w>4&&h>4&&w*h>Math.min(a.rect.width*a.rect.height,b.rect.width*b.rect.height)*.25)add('OVERLAPPING_CONTROLS','review','Action hit regions overlap; inspect stacking and intended nesting.',a,{other:b.id});}
  const occupied=new Set(),grid=20;for(const n of g.nodes.filter(n=>n.ownText||n.interactive||['img','svg','canvas','video'].includes(n.tag))){const r=n.rect;for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const cx=(x+.5)*g.viewport.width/grid,cy=(y+.5)*g.viewport.height/grid;if(cx>=r.x&&cx<r.x+r.width&&cy>=r.y&&cy<r.y+r.height)occupied.add(y*grid+x);}}
  const density=occupied.size/(grid*grid);if(density<.18)add('VISUAL_VOID_REVIEW_REQUIRED','review','Low first-screen occupancy needs a composition review, rather than an automatic sparse-design failure.',null,{firstScreenDensity:density});
  const cards=g.nodes.filter(n=>parseFloat(n.borderRadius)>8&&n.rect.width>120&&n.rect.height>80);if(cards.length>=8)add('REPETITIVE_CARD_COMPOSITION','review','Repeated rounded-card structure needs product-specific hierarchy and density review.',null,{cardCount:cards.length});
  for(const i of g.images){if(i.complete&&i.naturalWidth===0)add('BROKEN_IMAGE','P1','Rendered image failed to load.');if(i.placeholder)add('PLACEHOLDER_MEDIA','review','A placeholder image needs product-quality review.');}
  for(const key of g.visibleKeyCandidates??[])if(translationKeys.includes(key))add('UNTRANSLATED_KEY','P1','A translation key is visible in the rendered interface.',null,{key});
  return findings;
}
