import {inspectBundle} from './bundle.mjs';
import {inspectApk} from './apk.mjs';
if(!process.argv[2])throw Error('ARTIFACT_PATH_REQUIRED');
const file=process.argv[2],tools=process.env.MOBILE_ANDROID_TOOLS?JSON.parse(process.env.MOBILE_ANDROID_TOOLS):{};
console.log(JSON.stringify(file.endsWith('.aab')?await inspectBundle(file,tools):await inspectApk(file,{...tools,observationOnly:process.argv[3]==='--observation-only'})));
