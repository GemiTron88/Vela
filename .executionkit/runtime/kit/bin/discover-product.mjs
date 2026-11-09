#!/usr/bin/env node
import path from 'node:path';
import { discoverProduct, writeDiscovery } from '../lib/discovery-model.mjs';
import { loadConfig } from '../lib/execution-model.mjs';

const args = process.argv.slice(2), root = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');
try {
  const { config } = loadConfig(root);
  const inventory = discoverProduct(root);
  const file = writeDiscovery(root, inventory, config.discovery?.inventoryPath ?? '.executionkit/discovery/product-inventory.json');
  console.log(JSON.stringify({ ...inventory, output: path.relative(root, file).split(path.sep).join('/') }, null, 2));
} catch (error) {
  console.error(`Product discovery failed: ${error.message}`);
  process.exit(1);
}
