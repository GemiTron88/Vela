import {inspectApk} from './apk.mjs';
console.log(JSON.stringify(await inspectApk(process.argv[2],{observationOnly:true})));
