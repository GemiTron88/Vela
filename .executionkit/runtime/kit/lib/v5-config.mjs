export const V5_STANDARD_TARGET='5.2.3';
export const V5_SUPPORTED_TARGETS=Object.freeze(['5.0.0','5.0.1','5.1.0','5.2.0','5.2.1','5.2.2','5.2.3']);
export const V5_SYSTEM_NAMES=Object.freeze(['execution','agent','state','content','seo','docs','audit','test','launch','visual','decision']);
export const isV5=config=>/^5\./.test(String(config?.standardVersion??''));
export const V5_DECISION_DEFAULTS=Object.freeze({enabled:true,level:'STANDARD',trigger:'preflight-postflight-wave-phase-release',engine:'bundled-deterministic',models:false,hotPathNetwork:false});
export function validateV5DecisionPolicy(config){
  if(!isV5(config))return [];
  const settings=config.decisionOS??{},system=config.v4?.systems?.decision??{};
  return settings.enabled===true&&settings.engine==='bundled-deterministic'&&settings.models===false&&settings.hotPathNetwork===false&&system.enabled===true&&system.engine==='bundled-deterministic'&&system.models===false&&system.hotPathNetwork===false&&['LITE','STANDARD','FULL'].includes(system.level)&&system.trigger===V5_DECISION_DEFAULTS.trigger?[]:[{code:'V5_DECISION_POLICY_INVALID',system:'decision',message:'v5 requires the bundled deterministic Decision OS; models and hot-path networking are forbidden'}];
}
