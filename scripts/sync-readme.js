#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(process.cwd());
const rootReadmePath = path.join(projectRoot, 'README.md');
const npmReadmePath = path.join(projectRoot, 'bin', 'README-NPM.md');
const backupReadmePath = path.join(projectRoot, '.README.backup.md');

const action = process.argv[2];

if (action === 'prepublish') {
    if (fs.existsSync(rootReadmePath)) {
        fs.copyFileSync(rootReadmePath, backupReadmePath);
    }

    fs.copyFileSync(npmReadmePath, rootReadmePath);
    process.exit(0);
}

if (action === 'postpublish') {
    if (fs.existsSync(backupReadmePath)) {
        fs.copyFileSync(backupReadmePath, rootReadmePath);
        fs.unlinkSync(backupReadmePath);
    }

    process.exit(0);
}

console.error('Usage: node scripts/sync-readme.js <prepublish|postpublish>');
process.exit(1);