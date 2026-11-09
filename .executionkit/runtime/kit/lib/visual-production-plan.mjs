import fs from 'node:fs';
import path from 'node:path';
import {detectVisualSurfaces} from './visual-os.mjs';
import {inspectVisualProduction,REQUIRED_VISUAL_ROLES,VISUAL_PRODUCTION_FILE} from './visual-production.mjs';
import {loadConfig} from './execution-model.mjs';

const methodForRole={
  hero:'ORIGINAL_VECTOR_FIRST__GENERATE_COMPLEX_SCENE_ONLY_IF_NEEDED',
  banner:'ORIGINAL_VECTOR_FIRST__GENERATE_COMPLEX_SCENE_ONLY_IF_NEEDED',
  background:'DRAW_LOCAL_SVG_OR_NATIVE_CSS',
  illustration:'DRAW_ORIGINAL_SVG_FIRST',
  icon:'DRAW_NATIVE_VECTOR_OR_USE_LICENSED_LOCAL_ICON',
  empty:'DRAW_ORIGINAL_SVG_FIRST',
  dynamic:'APPROVED_CATEGORY_VECTOR_FIRST__PRIVATE_DATA_NEVER_EXTERNAL',
};
const FALLBACK='IF_GENERATION_LIMITED_SEARCH_HIGH_PROMPT_MATCH_RIGHTS_VERIFIED_COMMERCIAL_DERIVATIVE_SOURCE_THEN_ACTUALLY_ADAPT_THEME_CROP_SIZE_OR_BLOCK';
const intIn=(val,min,max,label)=>{
  if(!Number.isSafeInteger(val)||val<min||val>max)throw Error('VISUAL_MEDIA_'+label+'_INVALID');
  return val;
};
export function planVisualMedia(root,{scope={},offset=0,limit=100,verify=false}={}){
  root=path.resolve(root);
  intIn(offset,0,100000,'OFFSET');intIn(limit,1,100,'PAGE_LIMIT');
  if(!Object.keys(scope).length){
    // Respect installed monorepo UI scope when available, but allow fresh planning
    // before a project has completed ExecutionKit configuration.
    try{scope=loadConfig(root).config?.v4?.systems?.visual?.surfaceScope??{};}catch{scope={};}
  }
  const discovery=detectVisualSurfaces(root,5000,scope);
  const output=(status,extras={})=>({
    schemaVersion:'executionkit-visual-media-plan/v1',
    status,projectRoot:root,scope:discovery.scan.scope,
    methodOrder:['original-safe-vector-or-native-ui','high-fidelity-image-generation-when-necessary',
      'rights-cleared-high-match-online-asset-with-real-edits','explicit-blocker'],
    licensedOnlineFallback:FALLBACK,
    disclaimer:'Planning output is not generated media, proof of rights or screenshot QA.',
    ...extras,
  });
  if(!discovery.scan.complete)return output('BLOCKED',{
    code:discovery.scan.surfaceScanComplete?'VISUAL_DISCOVERY_INCOMPLETE':'VISUAL_SURFACE_CENSUS_INCOMPLETE',
    scannedFiles:discovery.scan.scannedFiles,discoveredSurfaceCount:discovery.scan.discoveredSurfaceCount,
  });
  if(!discovery.uiBearing)return output('NOT_APPLICABLE',{taskCount:0,tasks:[]});
  if(!discovery.surfaces.length)return output('BLOCKED',{
    code:'VISUAL_UI_NO_CONCRETE_SURFACES',message:'UI signals found but no actual screens; select accurate source scope.',
  });
  let manifest=null,parseProblem=null;
  const manifestPath=path.join(root,VISUAL_PRODUCTION_FILE);
  if(fs.existsSync(manifestPath)){
    try{
      const stat=fs.lstatSync(manifestPath);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw Error('INVALID_MANIFEST_FILE');
      manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
      if(manifest?.schemaVersion!=='executionkit-media-production/v1'||!Array.isArray(manifest.surfaces))
        throw Error('INVALID_MANIFEST_SCHEMA');
    }catch(e){manifest=null;parseProblem=e.message;}
  }
  const indexed=new Map((manifest?.surfaces??[]).filter(x=>x&&typeof x.source==='string').map(x=>[x.source,x]));
  const total=discovery.surfaces.length*REQUIRED_VISUAL_ROLES.length;
  const tasks=[];
  for(let i=offset;i<Math.min(total,offset+limit);i++){
    const surface=discovery.surfaces[Math.floor(i/REQUIRED_VISUAL_ROLES.length)];
    const role=REQUIRED_VISUAL_ROLES[i%REQUIRED_VISUAL_ROLES.length];
    const definition=indexed.get(surface.path)?.roles?.[role];
    const state=definition?.state==='not_applicable'?'REVIEW_NOT_APPLICABILITY':
      definition?.state==='required'?'VERIFY_ACTUAL_MEDIA':'ASSESS_AND_AUTHOR';
    tasks.push({
      id:'visual-production:'+i,
      screen:surface.path,stack:surface.stack,role,
      state,declaredAssetIds:definition?.state==='required'?definition.assetIds??[]:[],
      method:methodForRole[role],
      nextAction:state==='VERIFY_ACTUAL_MEDIA'
        ?'Confirm exact source bytes, theme variants, screenshot review and integration in real UI'
        :state==='REVIEW_NOT_APPLICABILITY'
        ?'Confirm independent reviewer proof for the screen-specific omission'
        :'Inspect real screen and its states; specify distinct scene if applicable or record reviewed not-applicable',
    });
  }
  const result=output(parseProblem?'BLOCKED':manifest?'PLAN':'NEEDS_MEDIA_MANIFEST',{
    code:parseProblem?'VISUAL_MEDIA_MANIFEST_INVALID':undefined,
    manifestExists:!!manifest,manifestError:parseProblem,
    surfaceCount:discovery.surfaces.length,taskCount:total,offset,limit,
    more:offset+limit<total,tasks,
    nextCommand:'executionkit visual media-check . --boundary=release',
  });
  if(verify){
    const proof=inspectVisualProduction(root,{boundary:'release',mandatory:true,surfaces:discovery.surfaces});
    result.evidence={status:proof.status,inventory:proof.inventory,findings:proof.findings};
    result.status=proof.status==='PASS'?'PASS':'BLOCKED';
  }
  return result;
}
