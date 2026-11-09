import { inflateRawSync } from 'node:zlib';
import { scrubRuntime } from './visual-contract.mjs';

function scrubRecord(value,key=''){
  if(/^(?:authorization|cookie|cookies|headers|password|token|secret|storageState|postData|value|text)$/.test(key))return '[REDACTED]';
  if(typeof value==='string')return scrubRuntime(value);
  if(Array.isArray(value))return value.map(v=>scrubRecord(v));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrubRecord(v,k)]));
  return value;
}
function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
// Native Playwright traces contain request headers/cookies even with snapshots
// disabled. Retain action/stack records only; discard network bodies/resources.
export function sanitizeVisualTrace(zip){
  if(zip.length>64*1024*1024)throw new Error('VISUAL_TRACE_BUDGET');
  let eocd=-1;for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  if(eocd<0)throw new Error('VISUAL_TRACE_CORRUPT');
  const total=zip.readUInt16LE(eocd+10),start=zip.readUInt32LE(eocd+16),kept=[];if(total>10000)throw new Error('VISUAL_TRACE_BUDGET');let offset=start,decoded=0;
  for(let i=0;i<total;i++){
    if(zip.readUInt32LE(offset)!==0x02014b50)throw new Error('VISUAL_TRACE_CORRUPT');
    const method=zip.readUInt16LE(offset+10),compressed=zip.readUInt32LE(offset+20),size=zip.readUInt32LE(offset+24),nameLen=zip.readUInt16LE(offset+28),extra=zip.readUInt16LE(offset+30),comment=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42),name=zip.toString('utf8',offset+46,offset+46+nameLen);offset+=46+nameLen+extra+comment;
    if(!/^[\w.-]+\.(?:trace|stacks)$/.test(name))continue;
    decoded+=size;if(decoded>32*1024*1024||![0,8].includes(method)||zip.readUInt32LE(local)!==0x04034b50)throw new Error('VISUAL_TRACE_CORRUPT');
    const begin=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),raw=zip.subarray(begin,begin+compressed),bytes=method===8?inflateRawSync(raw,{maxOutputLength:size}):raw;
    if(bytes.length!==size)throw new Error('VISUAL_TRACE_CORRUPT');
    // Tracing starts after authentication/state setup. No entered credentials
    // or storage-state records may enter this retained action-only archive.
    const lines=bytes.toString('utf8').split('\n').filter(Boolean).map(line=>{const record=JSON.parse(line);if(record.type==='resource-snapshot'||record.type==='frame-snapshot')return null;return JSON.stringify(scrubRecord(record));}).filter(Boolean);
    kept.push({name,bytes:Buffer.from(lines.join('\n')+'\n')});
  }
  if(!kept.length)throw new Error('VISUAL_TRACE_EMPTY');
  const locals=[],central=[];let position=0;
  for(const f of kept){const name=Buffer.from(f.name),crc=crc32(f.bytes),l=Buffer.alloc(30),c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt32LE(crc,14);l.writeUInt32LE(f.bytes.length,18);l.writeUInt32LE(f.bytes.length,22);l.writeUInt16LE(name.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(f.bytes.length,20);c.writeUInt32LE(f.bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(position,42);locals.push(l,name,f.bytes);central.push(c,name);position+=l.length+name.length+f.bytes.length;}
  const end=Buffer.alloc(22),centralBytes=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(kept.length,8);end.writeUInt16LE(kept.length,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(position,16);return Buffer.concat([...locals,centralBytes,end]);
}
