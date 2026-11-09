// Legacy v2/v3 scaffolding remains on its tested compatibility target.
// New projects use the canonical CLI and its v5 installer instead.
export function legacyDistributionVersion(sourceVersion){
  return /^5\./.test(String(sourceVersion??''))?'4.1.0':sourceVersion;
}
