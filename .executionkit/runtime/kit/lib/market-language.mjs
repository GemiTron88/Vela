// Market voice comes only from an explicit project policy; never infer it or call a model on the hot path.
export const EGYPTIAN_COLLOQUIAL_CUES=Object.freeze(['مش','شوية','عايز','عايزة','ازاي','دلوقتي','لسه','مفيش','متقلقش','هتلاقي','هتختار','هنساعدك','بتاعت','يلا بينا','من غير ما']);
const clean=value=>String(value??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const arabic=/[\u0621-\u064A]/;
function cuePattern(phrase){
  const parts=clean(phrase).split(' ').filter(Boolean).map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const prefix=parts[0]==='لسه'?'(?:[وفبكل])?':'(?:[وفبكلس])?';
  const body=parts.length===1?`${prefix}${parts[0]}`:parts.join('\\s+');
  return new RegExp('(?:^|[^\\p{L}])'+body+'(?=$|[^\\p{L}])','u');
}
const cues=EGYPTIAN_COLLOQUIAL_CUES.map(term=>({term,re:cuePattern(term)}));
export function validateMarketVoice(profile){
  if(profile==null)return [];
  if(!profile||typeof profile!=='object'||Array.isArray(profile)||!/^([a-z]{2})(?:-[A-Z]{2})?$/.test(profile.locale??'')||
    !['formal','neutral','conversational'].includes(profile.register)||
    (profile.forbiddenDialects!==undefined&&(!Array.isArray(profile.forbiddenDialects)||profile.forbiddenDialects.some(v=>!/^([a-z]{2})-[A-Z]{2}$/.test(v))))||
    (profile.forbiddenTerms!==undefined&&(!Array.isArray(profile.forbiddenTerms)||profile.forbiddenTerms.length>80||profile.forbiddenTerms.some(v=>typeof v!=='string'||!/^[\p{L}\s]{2,60}$/u.test(v.trim()))))||
    (profile.brandVoice!==undefined&&(typeof profile.brandVoice!=='string'||profile.brandVoice.length>240)))
    return [{code:'LANG_MARKET_PROFILE_INVALID',severity:'HIGH',message:'Require locale and formal|neutral|conversational register with bounded optional dialect/lexicon policy'}];
  return [];
}
export function inspectMarketCopy(value,profile,{path=null,locale=null,key=null}={}){
  if(!profile||validateMarketVoice(profile).length||!String(profile.locale).startsWith('ar')||
    locale&&!String(locale).startsWith('ar')||!arabic.test(String(value)))return [];
  const text=clean(value).slice(0,16000),rejectColloquial=profile.register==='formal'||(profile.forbiddenDialects??[]).includes('ar-EG');
  const patterns=[...(rejectColloquial?cues:[]),...(profile.forbiddenTerms??[]).map(term=>({term,re:cuePattern(term)}))];
  return [...new Map(patterns.filter(cue=>cue.re.test(text)).map(({term})=>[clean(term),{
    code:'LANG_MARKET_DIALECT_MISMATCH',severity:'HIGH',path,locale:locale??profile.locale,key,term,
    message:'Visible Arabic copy conflicts with the approved market voice; rewrite it in the brand register'
  }])).values()].slice(0,16);
}
export function uiCopySamples(rel,body){
  if(!/\.(?:blade\.php|html?|jsx|tsx|vue|svelte|dart)$/i.test(rel))return [];
  const markup=body.replace(/<!--[\s\S]*?-->/g,'').replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,'');
  const values=[];
  for(const pattern of [/>([^<>]{1,360})</g,/["'\x60]([\u0600-\u06FF][^"'\x60<>\n]{2,320})["'\x60]/g]){
    for(const match of markup.matchAll(pattern)){if(values.length>=400)break;const value=match[1].replace(/\s+/g,' ').trim();if(arabic.test(value))values.push(value);}
  }
  return values;
}
