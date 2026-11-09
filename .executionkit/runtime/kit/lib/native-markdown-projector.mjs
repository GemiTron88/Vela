import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const markerKey = marker => marker === ' ' ? 'space' : marker;
const markerFromKey = key => key === 'space' ? ' ' : key;

function signalState(description) {
  const text = description.toLowerCase();
  if (/\b(blocked?|blocker)\b|\b(?:معطل|محظور|موقوف)\b/u.test(text)) return 'BLOCKED';
  if (/\b(correction|required correction|needs? correction|fix required)\b|\b(?:تصحيح|إصلاح)\b/u.test(text)) return 'CORRECTION_REQUIRED';
  if (/\b(review|review pending|implementation complete)\b|\b(?:مراجعة)\b/u.test(text)) return 'REVIEW_REQUIRED';
  if (/\b(partial|in progress|durable work exists)\b|\b(?:جزئي|قيد التنفيذ)\b/u.test(text)) return 'IN_PROGRESS';
  if (/\b(accepted|complete|completed|closed)\b|\b(?:مقبول|مكتمل|مغلق)\b/u.test(text)) return 'ACCEPTED';
  if (/\b(open|ready|todo|planned)\b|\b(?:مفتوح|جاهز|مخطط)\b/u.test(text)) return 'PLANNED';
  return null;
}

function statusSection(markdown) {
  const lines = markdown.split('\n');
  let start = -1, level = null, end = lines.length;
  for (let i=0;i<lines.length;i++) {
    const heading = lines[i].match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    if (!heading) continue;
    if (start < 0 && /status\s+semantics|حالات\s+المهام|دلالات\s+الحالة/i.test(heading[2])) { start=i+1; level=heading[1].length; continue; }
    if (start >= 0 && heading[1].length <= level) { end=i; break; }
  }
  return start < 0 ? null : { start, end, lines };
}

export function inferNativeMarkdownContract(markdown) {
  const section = statusSection(markdown);
  if (!section) return { ok:false, errors:['Canonical TODO uses nonstandard completion markers but has no explicit Status semantics section. Add explicit semantics or configure a projection adapter; ExecutionKit will not guess lifecycle meaning.'] };
  const markerStates = {}, errors=[];
  for (let i=section.start;i<section.end;i++) {
    const match=section.lines[i].match(/^\s*[-*+]\s+\[([^\]])\]\s+(.+)$/);
    if (!match) continue;
    const marker=match[1], state=signalState(match[2]);
    if (!state) { errors.push(`Status semantics line ${i+1} for marker [${marker}] is not canonically interpretable`); continue; }
    const key=markerKey(marker);
    if (markerStates[key] && markerStates[key]!==state) errors.push(`Status semantics marker [${marker}] is contradictory`);
    markerStates[key]=state;
  }
  const semanticRange = new Set(Array.from({length:section.end-section.start},(_,index)=>section.start+index));
  const used = new Set();
  const lines=section.lines;
  let fence=false;
  for (let i=0;i<lines.length;i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence=!fence; continue; }
    if (fence || semanticRange.has(i)) continue;
    const match=lines[i].match(/^\s*[-*+]\s+\[([^\]])\]\s+(.+)$/);
    if (!match) continue;
    if (!/(?:`([A-Za-z][A-Za-z0-9._-]*-[A-Za-z0-9._-]+)`|^([A-Za-z][A-Za-z0-9._-]*-[A-Za-z0-9._-]+)\b)/.test(match[2].trim())) continue;
    used.add(match[1]);
  }
  if (!used.size) errors.push('No stable-ID native checklist tasks were found outside the Status semantics section');
  for (const marker of used) if (!markerStates[markerKey(marker)]) errors.push(`Used task marker [${marker}] has no unambiguous declared Status semantics`);
  return { ok:errors.length===0, markerStates, usedMarkers:[...used].map(markerKey), errors };
}

function cleanText(value) { return String(value ?? '').trim().replace(/^`|`$/g,'').replace(/\.$/,'').trim(); }
function splitDeps(value) {
  const raw=cleanText(value);
  if (!raw || /^(none|n\/a|na|-)$/i.test(raw)) return [];
  const out=[];
  for (const token of raw.split(/[,;]/).map(cleanText).filter(Boolean)) {
    const range=token.match(/^(.+?)(\d+)\.\.(.+?)(\d+)$/);
    if (range && range[1]===range[3]) {
      const from=Number(range[2]), to=Number(range[4]), width=Math.max(range[2].length,range[4].length);
      if (Number.isInteger(from) && Number.isInteger(to) && to>=from && to-from<=500) {
        for (let n=from;n<=to;n++) out.push(`${range[1]}${String(n).padStart(width,'0')}`);
        continue;
      }
    }
    out.push(token.replace(/`/g,''));
  }
  return [...new Set(out)];
}
function firstReference(value) {
  const refs=[...String(value ?? '').matchAll(/`([^`]+)`/g)].map(match=>match[1]).filter(item=>/[/.]/.test(item));
  return refs[0] ?? 'NONE';
}
function fieldName(value) {
  const key=value.toLowerCase().replace(/[^a-z]/g,'');
  if (['deps','dep','depends','dependencies'].includes(key)) return 'Depends';
  if (['refs','ref','references','contract'].includes(key)) return 'Refs';
  if (['accept','acceptance','verification','verify'].includes(key)) return 'Verification';
  if (['deliver','objective','outcome'].includes(key)) return 'Deliver';
  if (['evidence','proof'].includes(key)) return 'Evidence';
  if (['blocker','blockedby','blockingcondition'].includes(key)) return 'Blocker';
  if (['priority'].includes(key)) return 'Priority';
  if (['phase'].includes(key)) return 'Phase';
  if (['action'].includes(key)) return 'Action';
  if (['auditboundary','boundary'].includes(key)) return 'Audit Boundary';
  if (['tags','tag'].includes(key)) return 'Tags';
  return value.trim();
}

export function projectNativeMarkdown(markdown,{sourcePath='TODO.md',markerStates={}}={}) {
  const section=statusSection(markdown), semanticLines=new Set();
  if (section) for (let i=section.start;i<section.end;i++) semanticLines.add(i);
  const lines=markdown.split('\n'), tasks=[], errors=[], seen=new Set();
  let fence=false;
  for (let i=0;i<lines.length;i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence=!fence; continue; }
    if (fence || semanticLines.has(i)) continue;
    const match=lines[i].match(/^\s*[-*+]\s+\[([^\]])\]\s+(.+)$/);
    if (!match) continue;
    const rawTitle=match[2].trim();
    const idMatch=rawTitle.match(/^(?:`([A-Za-z][A-Za-z0-9._-]*-[A-Za-z0-9._-]+)`|([A-Za-z][A-Za-z0-9._-]*-[A-Za-z0-9._-]+)\b)/);
    if (!idMatch) continue;
    const id=idMatch[1] ?? idMatch[2], state=markerStates[markerKey(match[1])];
    if (!state) { errors.push(`${sourcePath}:${i+1}: marker [${match[1]}] has no configured canonical state`); continue; }
    if (seen.has(id)) { errors.push(`${sourcePath}:${i+1}: duplicate native task id ${id}`); continue; }
    seen.add(id);
    const title=rawTitle.slice(idMatch[0].length).replace(/^\s*\*\*|\*\*$/g,'').trim() || id;
    const fields={}; let end=i+1;
    for (;end<lines.length;end++) {
      if (/^\s*#{1,6}\s+/.test(lines[end]) || /^\s*[-*+]\s+\[[^\]]\]\s+/.test(lines[end])) break;
      const field=lines[end].match(/^\s+[-*+]\s+(?:\*\*)?([A-Za-z][A-Za-z -]*?)(?::\*\*|\*\*:|:)\s*(.*)$/);
      if (field) fields[fieldName(field[1])]=field[2].trim();
    }
    const deps=splitDeps(fields.Depends), phase=cleanText(fields.Phase) || id.split('-')[0] || 'NATIVE';
    const verification=cleanText(fields.Verification) || 'Native acceptance criteria are declared in the canonical TODO task';
    tasks.push({
      id,title,state,phase,priority:cleanText(fields.Priority)||'P1',dependencies:deps,
      action:cleanText(fields.Action)||undefined,auditBoundary:cleanText(fields['Audit Boundary'])||undefined,
      contract:firstReference(fields.Refs),verification,evidence:cleanText(fields.Evidence)||'PENDING',
      blocker:cleanText(fields.Blocker),tags:cleanText(fields.Tags).split(/[,;]/).map(item=>item.trim()).filter(Boolean),
      objective:cleanText(fields.Deliver)||title,sourcePath,startLine:i+1,order:tasks.length,
    });
  }
  const byId=new Map(tasks.map(task=>[task.id,task]));
  for (const task of tasks) {
    if (task.state!=='PLANNED') continue;
    const ready=task.dependencies.every(id=>['ACCEPTED','RELEASED'].includes(byId.get(id)?.state));
    if (ready) task.state='READY';
  }
  return {tasks,errors};
}

export function buildNativeMarkdownProjection(projectRoot,config) {
  const todoPath=config.todoPath ?? 'TODO.md', full=path.resolve(projectRoot,todoPath);
  if (!full.startsWith(path.resolve(projectRoot)+path.sep) || !fs.existsSync(full)) throw new Error(`Native TODO missing or unsafe: ${todoPath}`);
  const markdown=fs.readFileSync(full,'utf8'), contract=config.taskModel?.nativeMarkdown;
  if (!contract?.markerStates || typeof contract.markerStates!=='object') throw new Error('native-markdown projection requires taskModel.nativeMarkdown.markerStates');
  const projected=projectNativeMarkdown(markdown,{sourcePath:todoPath,markerStates:contract.markerStates});
  if (projected.errors.length) throw new Error(projected.errors.join('; '));
  return {
    schemaVersion:'2.0.0',
    sources:[{path:todoPath,sha256:sha256(fs.readFileSync(full))}],
    tasks:projected.tasks,
    nativeMarkdown:{contractVersion:contract.contractVersion ?? '1',markerStates:contract.markerStates},
  };
}

export function markerStatesForRuntime(contract) {
  return Object.fromEntries(Object.entries(contract?.markerStates ?? {}).map(([key,state])=>[markerFromKey(key),state]));
}
