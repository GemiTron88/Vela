// Schema authoring uses Zod; the installed CLI runs canonical Ajv standalone
// validators and audited local helpers without npm install or ambient modules.
import compiled from './visual-schema-compiled.cjs';
export const {visualConfigSchema,visualArtifactSchema,visualReviewSchema,visualRunSchema,visualRemediationSchema,visualFindingSchema}=compiled;
export function validateVisualSchema(schema,value){
  const candidate=schema===visualRemediationSchema?{...value,minimumChangedPixelRatio:value?.minimumChangedPixelRatio??.001}:value;
  if(!schema(candidate))throw new Error('VISUAL_SCHEMA_INVALID: '+(schema.errors??[]).slice(0,15).map(i=>(i.instancePath||'/')+': '+i.message).join('; '));
  return candidate;
}
