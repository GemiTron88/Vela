import {readFile, writeFile} from 'node:fs/promises';
import {classifyGit} from './classifier.mjs';
const [repository, flutterPath, base, target, baselinePath, targetPath, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node src/classify-cli.mjs repo flutter_path base_sha target_sha baseline.json target.json output.json');
const report = classifyGit(repository, flutterPath, base, target, JSON.parse(await readFile(baselinePath)), JSON.parse(await readFile(targetPath)));
await writeFile(output, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({classification: report.classification, report_sha256: report.report_sha256}));
