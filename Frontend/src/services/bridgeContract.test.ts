import fs from 'node:fs';
import path from 'node:path';
import { BRIDGE_ACTIONS } from './bridgeActions';
import { describe, expect, it } from 'vitest';

type BridgeContract = {
  actions: string[];
};

const repoRoot = path.resolve(process.cwd(), '..');
const contractPath = path.join(repoRoot, 'bridge-actions.json');
const bridgeSourcePath = path.join(process.cwd(), 'src', 'services', 'bridge.ts');

function readContract(): BridgeContract {
  return JSON.parse(fs.readFileSync(contractPath, 'utf8')) as BridgeContract;
}

function extractFrontendActions(): string[] {
  const bridgeSource = fs.readFileSync(bridgeSourcePath, 'utf8');
  const matches = bridgeSource.matchAll(/this\.send[\s\S]*?\(\s*BRIDGE_ACTIONS\.([A-Z0-9_]+)/g);
  return [...new Set([...matches].map((match) => BRIDGE_ACTIONS[match[1] as keyof typeof BRIDGE_ACTIONS]))];
}

describe('bridge action contract', () => {
  it('keeps frontend bridge calls backed by the shared contract', () => {
    const contract = readContract();
    const frontendActionKeys = extractFrontendActions();

    expect(frontendActionKeys).not.toHaveLength(0);
    expect(frontendActionKeys.sort()).toEqual(contract.actions.sort());
  });
});
