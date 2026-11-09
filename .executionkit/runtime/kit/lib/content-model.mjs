import fs from 'node:fs';
import path from 'node:path';
import { discoverProduct } from './discovery-model.mjs';

const PLACEHOLDER = /(?:\b(?:lorem ipsum|todo content|placeholder content|sample text|dummy text|replace me)\b|\[insert\s+[^\]]+\]|نص تجريبي|محتوى تجريبي)/i;
const DEMO_MOCK = /\b(?:demo data|mock data|fake data|sample product|sample user|john doe|jane doe|example item|user@example\.com)\b/i;
const UNFINISHED = /(?:\b(?:coming soon|content coming soon|tbd content|fixme content|todo:?[ ]+(?:copy|content|text))\b|قريباً|قريبا|سيتم الإضافة)/i;
const STRUCTURAL_VIEW = /(?:^|\/)(?:components?|partials?|layouts?|includes?)\//i;

function localizationSignals(root){
  const candidates=['resources/lang','lang','l10n','lib/l10n','assets/i18n','src/i18n','locales','messages','src/locales','public/locales'];
  const roots=candidates.filter((rel)=>fs.existsSync(path.join(root,...rel.split('/'))));
  let localeFileCount=0;
  for(const rel of roots){
    const full=path.join(root,...rel.split('/'));
    const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.isFile()&&/\.(?:json|ya?ml|php|arb|po)$/i.test(entry.name))localeFileCount++;}};
    try{walk(full);}catch{}
  }
  return {roots,localeFileCount,multiLocaleLikely:localeFileCount>=2};
}

export function discoverContent(root) {
  const inventory = discoverProduct(root), items = [];
  for (const item of inventory.items.filter((i) => ['content', 'view', 'screen'].includes(i.kind))) {
    const file = path.join(root, item.path);
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch {}
    const visibleText = text.replace(/^\s*import\s+.*$/gm, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const textWithoutInputPlaceholders = text.replace(/\bplaceholder\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    const structural=item.kind==='view'&&STRUCTURAL_VIEW.test(item.path);
    items.push({ ...item, bytes: Buffer.byteLength(text), structural, placeholder: PLACEHOLDER.test(text), demoMock: DEMO_MOCK.test(textWithoutInputPlaceholders), unfinished:UNFINISHED.test(text), thin: !structural&&visibleText.length < 80 });
  }
  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    items,
    localization:localizationSignals(root),
    counts: { total: items.length, placeholder: items.filter((i) => i.placeholder).length, demoMock:items.filter((i)=>i.demoMock).length, unfinished:items.filter((i)=>i.unfinished).length, thin: items.filter((i) => i.thin).length },
  };
}

export function validateContentDepth(root) {
  const report = discoverContent(root), findings = [];
  if (!report.items.length) return { ...report, findings, status: 'NOT_APPLICABLE' };
  for (const item of report.items) {
    if (item.placeholder) findings.push({ code: 'PLACEHOLDER_CONTENT', severity: 'HIGH', path: item.path });
    if (item.demoMock) findings.push({ code: 'DEMO_OR_MOCK_CONTENT', severity: 'HIGH', path: item.path });
    if (item.unfinished) findings.push({ code: 'UNFINISHED_CONTENT', severity: 'HIGH', path: item.path });
    if (item.thin) findings.push({ code: 'THIN_CONTENT', severity: 'REVIEW', path: item.path });
  }
  return { ...report, findings, status: findings.some((f) => f.severity === 'HIGH') ? 'FAIL' : findings.length ? 'REVIEW_REQUIRED' : 'PASS' };
}
