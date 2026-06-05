#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';

import processReadme from '../src/processReadme.js';
import {
    buildLocalFileTree,
    collectNodeDependencies,
    collectPythonDependencies,
    collectScripts,
    getLicenseName
} from '../src/readmeContext.js';

const args = process.argv.slice(2);

const supportsColor = process.stdout.isTTY && process.env.NO_COLOR !== '1';
const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
};

function colorize(text, ...codes) {
    if (!supportsColor) {
        return text;
    }
    return `${codes.join('')}${text}${ANSI.reset}`;
}

function formatLabel(label, color) {
    return colorize(label, ANSI.bold, color);
}

function printHelp(output = console.log) {
    output([
        formatLabel('Usage', ANSI.blue),
        `  ${colorize('blytz', ANSI.bold, ANSI.green)} ${colorize('[path] [options]', ANSI.dim)}`,
        '',
        formatLabel('Commands / Options', ANSI.blue),
        `  ${colorize('--update', ANSI.yellow)}         ${colorize('Update the existing README.md using project metadata. (Default)', ANSI.dim)}`,
        `  ${colorize('--init', ANSI.yellow)}           ${colorize('Create a new README.md and prompt for title and description.', ANSI.dim)}`,
        `  ${colorize('--force', ANSI.yellow)}          ${colorize('Replace the existing README.md with a newly generated one.', ANSI.dim)}`,
        `  ${colorize('--dry-run, -d', ANSI.yellow)}    ${colorize('Print the generated README to stdout instead of writing to disk.', ANSI.dim)}`,
        `  ${colorize('--depth, -D <num>', ANSI.yellow)} ${colorize('Specify directory structure tree rendering depth (default: 3).', ANSI.dim)}`,
        `  ${colorize('--help, -h', ANSI.yellow)}       ${colorize('Show this help message.', ANSI.dim)}`,
        '',
    ].join('\n'));
}

// Parse custom depth option
const depthIndex = args.findIndex(arg => arg === '--depth' || arg === '-D');
let customDepth = 3;
if (depthIndex !== -1 && depthIndex + 1 < args.length) {
    const val = parseInt(args[depthIndex + 1], 10);
    if (!isNaN(val)) {
        customDepth = val;
    }
}

// Separate positional arguments (path) from options
const cleanArgs = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--depth' || args[i] === '-D') {
        i++; // skip next arg (depth value)
        continue;
    }
    if (args[i].startsWith('-')) {
        continue; // skip option flags
    }
    cleanArgs.push(args[i]);
}

if (cleanArgs.length > 1) {
    console.error(`${formatLabel('Error', ANSI.red)} Too many directory paths specified.`);
    process.exit(1);
}

const targetPath = cleanArgs.length > 0 ? cleanArgs[0] : '.';

// Options checking
const shouldShowHelp = args.includes('--help') || args.includes('-h');
const shouldInit = args.includes('--init');
const shouldForce = args.includes('--force');
const shouldDryRun = args.includes('--dry-run') || args.includes('-d');
const shouldUpdate = args.includes('--update') || (!shouldInit && !shouldForce && !shouldShowHelp);
const hasAction = shouldUpdate || shouldInit || shouldForce;

const validOptions = new Set([
    '--help', '-h',
    '--init',
    '--force',
    '--update',
    '--dry-run', '-d',
    '--depth', '-D'
]);

const invalidOption = args.find(arg => arg.startsWith('-') && !validOptions.has(arg));
if (invalidOption) {
    console.error(`${formatLabel('Error', ANSI.red)} Option not available: ${colorize(invalidOption, ANSI.bold, ANSI.red)}`);
    console.error('');
    printHelp(console.error);
    process.exit(1);
}

if (shouldShowHelp) {
    printHelp();
    process.exit(0);
}

if (!hasAction) {
    printHelp();
    process.exit(0);
}

async function promptForTitleAndDescription() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        const titleContent = (await rl.question(`${formatLabel('Title', ANSI.yellow)} ${colorize('(leave blank to use project name)', ANSI.dim)}: `)).trim();
        const descriptionContent = (await rl.question(`${formatLabel('Description', ANSI.yellow)} ${colorize('(leave blank to use default intro)', ANSI.dim)}: `)).trim();
        return { titleContent, descriptionContent };
    } finally {
        rl.close();
    }
}

async function main() {
    const targetDir = path.resolve(targetPath);
    if (!fs.existsSync(targetDir)) {
        console.error(`${formatLabel('Error', ANSI.red)} Directory does not exist: ${colorize(targetDir, ANSI.bold, ANSI.red)}`);
        process.exit(1);
    }

    if (!shouldDryRun) {
        console.log(`${formatLabel('Info', ANSI.cyan)} Scanning for project files...`);
    }

    const readmePath = path.join(targetDir, 'README.md');
    const packageJsonPath = path.join(targetDir, 'package.json');
    const requirementsPath = path.join(targetDir, 'requirements.txt');
    const pyprojectPath = path.join(targetDir, 'pyproject.toml');
    const pipfilePath = path.join(targetDir, 'Pipfile');
    const licensePath = path.join(targetDir, 'LICENSE');

    const readmeExists = fs.existsSync(readmePath);
    const hasPackageJson = fs.existsSync(packageJsonPath);
    const hasRequirements = fs.existsSync(requirementsPath);
    const hasPyproject = fs.existsSync(pyprojectPath);
    const hasPipfile = fs.existsSync(pipfilePath);
    const hasLicense = fs.existsSync(licensePath);

    if (!readmeExists && !shouldInit && !shouldForce) {
        console.error(`${formatLabel('Error', ANSI.red)} No README.md found in this directory. Try ${colorize('--init', ANSI.bold, ANSI.yellow)}.`);
        process.exit(1);
    }

    if (readmeExists && shouldInit && !shouldForce) {
        console.error(`${formatLabel('Error', ANSI.red)} README.md already exists. Try ${colorize('--force', ANSI.bold, ANSI.red)}.`);
        process.exit(1);
    }

    if (!hasPackageJson && !hasRequirements && !hasPyproject && !hasPipfile) {
        console.error(`${formatLabel('Error', ANSI.red)} No package metadata file (package.json, requirements.txt, pyproject.toml, or Pipfile) found in this directory.`);
        process.exit(1);
    }

    if (!shouldDryRun) {
        console.log(`${formatLabel('Info', ANSI.cyan)} Files found. Processing README...`);
    }

    if (shouldForce && readmeExists && !shouldDryRun) {
        fs.unlinkSync(readmePath);
    }

    const readmeContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : '';
    const fileTree = buildLocalFileTree(fs, path, targetDir, targetDir, [], 0, customDepth);
    const projectName = path.basename(targetDir);

    // Resolve License Name
    let licenseName = hasLicense ? getLicenseName(fs.readFileSync(licensePath, 'utf-8')) : '';

    // Detect Alternative Node Package Managers
    const hasYarnLock = fs.existsSync(path.join(targetDir, 'yarn.lock'));
    const hasPnpmLock = fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'));
    const hasBunLock = fs.existsSync(path.join(targetDir, 'bun.lockb')) || fs.existsSync(path.join(targetDir, 'bun.lock'));
    let packageManager = "npm";
    if (hasYarnLock) packageManager = "yarn";
    else if (hasPnpmLock) packageManager = "pnpm";
    else if (hasBunLock) packageManager = "bun";

    const shouldPromptMetadata = !shouldUpdate && !shouldDryRun;
    const { titleContent, descriptionContent } = shouldPromptMetadata
        ? await promptForTitleAndDescription()
        : { titleContent: '', descriptionContent: '' };
    let context;
    let projectType;

    const getPkgLicense = (pkg) => {
        if (!pkg?.license) return '';
        if (typeof pkg.license === 'string') return pkg.license;
        if (typeof pkg.license === 'object') return pkg.license.type || '';
        return '';
    };

    if (hasPackageJson) {
        const packageJsonData = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonData);

        if (!licenseName) {
            licenseName = getPkgLicense(packageJson);
        }

        const usernameVal = packageJson.author || process.env.USERNAME || process.env.USER || 'Unknown Author';

        context = {
            packageJson,
            packages: [{ path: 'package.json', content: packageJson }],
            dependencies: collectNodeDependencies([{ path: 'package.json', content: packageJson }]),
            scripts: collectScripts([{ path: 'package.json', content: packageJson }]),
            fileTree,
            titleContent,
            descriptionContent,
            licenseName,
            username: typeof usernameVal === 'object' ? (usernameVal.name || 'Unknown Author') : usernameVal,
            projectName: packageJson.name || projectName,
            hasPackageJson: true,
            isMonorepo: false,
            packageManager
        };
        projectType = 'node';
    } else {
        const packages = [];
        if (hasRequirements) {
            packages.push({ path: 'requirements.txt', content: fs.readFileSync(requirementsPath, 'utf-8') });
        }
        if (hasPyproject) {
            packages.push({ path: 'pyproject.toml', content: fs.readFileSync(pyprojectPath, 'utf-8') });
        }
        if (hasPipfile) {
            packages.push({ path: 'Pipfile', content: fs.readFileSync(pipfilePath, 'utf-8') });
        }

        context = {
            packages,
            dependencies: collectPythonDependencies(packages),
            scripts: new Map(),
            fileTree,
            titleContent,
            descriptionContent,
            licenseName,
            username: process.env.USERNAME || process.env.USER || 'Unknown Author',
            projectName,
            hasPackageJson: false,
            isMonorepo: false
        };
        projectType = 'python';
    }

    const updatedReadme = processReadme(readmeContent, projectType, context);

    if (shouldDryRun) {
        console.log(updatedReadme);
    } else {
        fs.writeFileSync(readmePath, updatedReadme, 'utf-8');
        console.log(`${formatLabel('Success', ANSI.green)} README.md has been auto-fixed.`);
    }
}

main().catch(error => {
    console.error(`${formatLabel('Error', ANSI.red)} An error occurred during processing: ${error.message}`);
    process.exit(1);
});
