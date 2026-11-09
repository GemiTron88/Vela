// Conservative source evidence. A clean scan is not proof of live business data.
function executableSource(body){
  // Retain offsets and literals; exclude comments and regular-expression
  // definitions so a detector's own vocabulary is not treated as product data.
  let out='',quote=null,previous='',prevToken='';
  for(let i=0;i<body.length;i++){
    const c=body[i];
    if(quote){out+=c;if(c==='\\'&&i+1<body.length)out+=body[++i];else if(c===quote)quote=null;continue;}
    if(c==="'"&&/[A-Za-z]{2}/.test(body.slice(Math.max(0,i-2),i))&&/^(?:t|s|re|ve|ll|d|m)\b/i.test(body.slice(i+1,i+4))){out+=c;previous=c;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;out+=c;previous=c;continue;}
    if(c==='/'&&(body[i+1]==='/'||body[i+1]==='*')){
      const block=body[++i]==='*';out+='  ';
      for(i++;i<body.length;i++){if(block&&body[i]==='*'&&body[i+1]==='/'){out+='  ';i++;break;}if(!block&&body[i]==='\n'){out+='\n';break;}out+=body[i]==='\n'?'\n':' ';}continue;
    }
    if(c==='/'&&/[=(:,!\[?]/.test(previous)&&!(previous==='='&&/^(?:href|src|action|formaction|poster|data)$/i.test(prevToken))){
      out+=' ';let bracket=false;
      for(i++;i<body.length;i++){const ch=body[i];if(ch==='\n'){out+='\n';break;}out+=' ';if(ch==='\\'&&i+1<body.length&&body[i+1]!=='\n'){out+=' ';i++;continue;}if(ch==='[')bracket=true;if(ch===']')bracket=false;if(ch==='/'&&!bracket)break;}continue;
    }
    out+=c;
    if(/[A-Za-z0-9_-]/.test(c)){prevToken=/[A-Za-z0-9_-]/.test(body[i-1]??'')?prevToken+c:c;}
    if(!/\s/.test(c))previous=c;
  }
  return out;
}
function catchBody(source,start){
  let i=start;while(/\s/.test(source[i]??'')&&i<source.length)i++;
  if(source[i]!=='{')return source.slice(i,i+350).split(/[;\n]/)[0];
  const begin=++i;let depth=1,quote=null;
  for(;i<source.length&&i-begin<10000;i++){
    const c=source[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"||c==='`')quote=c;else if(c==='{')depth++;else if(c==='}'&&!--depth)return source.slice(begin,i);
  }
  return '';
}
export function antiFakeFindings(path,body){
  const code=executableSource(body);
  const findings=[];
  const add=(code,match,severity='HIGH')=>findings.push({code,severity,path,line:body.slice(0,match.index).split('\n').length,message:code});
  const rules=[
    ['ANTIFAKE_PRODUCTION_FAKER',/\buse\s+Faker\\|\b(?:fake|faker)\s*\(\s*\)|\b(?:jest\.mock|sinon\.stub|Mockery::mock)\s*\(/g],
    ['ANTIFAKE_PLACEHOLDER_WIDGET',/\b(?:return\s+)?(?:const\s+)?Placeholder\s*\(/g],
    ['ANTIFAKE_PRODUCTION_MOCK_IMPORT',/(?:from\s*|require\s*\(|import\s*\(?|include\s*\(?)["'][^"'\n]*(?:\b(?:faker|msw|json-server)\b|(?:^|[\/._-])(?:mocks?|fixtures?|fake-api|demo-data)(?:[\/._-]|["']))[^"'\n]*["']/gi],
    ['ANTIFAKE_SYNTHETIC_DATA',/(?:\b(?:const|let|var|final)\s+(?:[A-Za-z_$][\w$]*(?:<[^=\n;]{1,150}>)?\s+)?|\$)(?:mock|fake|dummy|demo|sample|placeholder)_?(?:data|users|products|orders|response|results|rows|items|customers)\w*\s*(?::[^=;\n]+)?=\s*(?:\[|\{|(?:Array|List)\.|jsonDecode\b)/gi],
    ['ANTIFAKE_SYNTHETIC_RESPONSE',/\breturn\s+(?:\$)?(?:mock|fake|dummy|demo|sample)_?(?:data|users|products|orders|response|results|rows|items|customers)\w*\b/gi],
    ['ANTIFAKE_PLACEHOLDER_CONTENT',/\blorem\s+ipsum\b|\[insert\s+[a-z0-9_\s-]+\]/gi],
    ['ANTIFAKE_UNIMPLEMENTED_PRODUCTION',/\bthrow\s+(?:new\s+)?(?:Error|Exception)\s*\(\s*["'](?:not implemented|todo)[.!]?\s*["']|\bthrow\s+(?:new\s+)?UnimplementedError\s*\(/gi],
  ];
  for(const [id,re] of rules)for(const match of code.matchAll(re))add(id,match);
  // Even neutral variable names can conceal invented business records. A
  // literal collection needs provenance review; enum/config/empty arrays do not.
  for(const match of code.matchAll(/(?:\b(?:const|let|var|final)\s+(?:[\w$]+(?:<[^=\n;]{1,150}>)?\s+)?|\$)(?:users|customers|products|orders|invoices|transactions|payments|businessData|apiResponse)\s*(?::[^=;\n]+)?=\s*\[\s*\{/gi))add('ANTIFAKE_HARDCODED_BUSINESS_DATA_REVIEW',match,'REVIEW');
  for(const match of body.matchAll(/\b(?:TODO|FIXME)\s*:?\s*(?:implement\b|replace\s+(?:the\s+)?(?:mock|fake|dummy)\b|connect\s+(?:the\s+)?real\s+(?:api|backend)\b)/gi))add('ANTIFAKE_PLACEHOLDER_CONTENT',match);
  // Catch bodies that turn failures into business success are never acceptance.
  // Ordinary defaults, real offline caches and input placeholder attributes are
  // not synthetic business data; only inspect explicit response/data shapes.
  for(const match of code.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*(?=\{)|\.(?:catch|catchError)\s*\(\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*(?:=>|(?=\{))/g)){
    const block=catchBody(code,match.index+match[0].length);
    if(/(?:\b(?:return|json|send)\b[\s\S]{0,250}?|^\s*\(?\s*\{[\s\S]{0,120}?)["']?(?:success|ok)["']?\s*(?::|=>)\s*true\b/.test(block))add('ANTIFAKE_FAILURE_AS_SUCCESS',match);
    else if(/(?:\breturn\s+|^\s*\(?)(?:\[\s*\{|\{\s*["']?(?:data|users|products|orders|customers)["']?\s*:)|\breturn\s+(?:\$)?(?:fallback|hardcoded|cachedDemo)(?:Data|Response|Rows|Users)\b/i.test(block))add('ANTIFAKE_DATA_FALLBACK_REVIEW',match,'REVIEW');
  }
  return findings;
}
