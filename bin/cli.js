#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import processReadme from '../src/processReadme.js';

const args = process.argv.slice(2);
const shouldShowHelp = args.includes('--help') || args.includes('-h');
const shouldInit = args.includes('--init');
const shouldForce = args.includes('--force');
const shouldUpdate = args.length === 0 || args.includes('--update');
const hasAction = shouldUpdate || shouldInit || shouldForce;

if (shouldShowHelp) {
    console.log('Usage: blytz [--update|--init|--force]');
    process.exit(0);
}

if (!hasAction) {
    console.log('Usage: blytz [--update|--init|--force]');
    process.exit(0);
}

function buildFileTree(dirPath, depth = 0, maxDepth = 4) {
    if (depth >= maxDepth) {
        return {};
    }

    const tree = {};
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => entry.name !== 'node_modules' && entry.name !== '.git')
        .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            tree[entry.name] = buildFileTree(entryPath, depth + 1, maxDepth);
        } else {
            tree[entry.name] = null;
        }
    }

    return tree;
}

function collectDependencies(packageJson) {
    return Object.keys(packageJson.dependencies || {}).sort();
}

function collectScripts(packageJson) {
    const scripts = new Map();

    for (const [name, command] of Object.entries(packageJson.scripts || {})) {
        scripts.set(name, [{ package: '(root)', command }]);
    }

    return scripts;
}

console.log("Scanning for project files...");

const targetDir = process.cwd();
const readmePath = path.join(targetDir, 'README.md');
const packageJsonPath = path.join(targetDir, 'package.json');
const readmeExists = fs.existsSync(readmePath);

if (!readmeExists && !shouldInit && !shouldForce) {
    console.error("Error: No README.md found in this directory. Try --init.");
    process.exit(1);
}

if (readmeExists && shouldInit && !shouldForce) {
    console.error("README.md already exists. Try --force.");
    process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) {
    console.error("Error: No package.json found in this directory.");
    process.exit(1);
}

console.log("Files found. Processing README...");

try {
    if (shouldForce && readmeExists) {
        fs.unlinkSync(readmePath);
    }

    // 1. Read the raw text of both files
    const readmeContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : '';
    const packageJsonData = fs.readFileSync(packageJsonPath, 'utf-8');

    // 2. Parse package.json to build the context object your engine expects
    const packageJson = JSON.parse(packageJsonData);
    const fileTree = buildFileTree(targetDir);
    const context = {
        packageJson,
        packages: [{ path: 'package.json', content: packageJson }],
        dependencies: collectDependencies(packageJson),
        scripts: collectScripts(packageJson),
        fileTree,
        username: packageJson.author || 'Unknown Author',
        projectName: packageJson.name || 'this project',
        hasPackageJson: true,
        isMonorepo: false
    };

    // 3. Feed everything into your pure engine
    // Hardcoding 'node' as projectType for now since we rely on package.json
    const updatedReadme = processReadme(readmeContent, 'node', context);

    // 4. Overwrite the existing README.md with the new content
    fs.writeFileSync(readmePath, updatedReadme, 'utf-8');

    console.log("Success! README.md has been auto-fixed.");

} catch (error) {
    console.error("An error occurred during processing:", error.message);
    process.exit(1);
}