import { getOctokit } from "./github.js";
import processReadme from "../src/processReadme.js";

async function findAllPackageJsonPaths(octokit, owner, repo) {
    try {
        const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}", {
            owner,
            repo,
        });
        const defaultBranch = repoData.default_branch;

        const { data: treeData } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner,
            repo,
            tree_sha: defaultBranch,
            recursive: "true",
        });

        const packageJsonPaths = treeData.tree
            .filter(item =>
                item.type === "blob" &&
                item.path.endsWith("package.json") &&
                !item.path.includes("node_modules/")
            )
            .map(item => item.path);

        return { packageJsonPaths, treeData };
    } catch (err) {
        console.error("Error scanning repository tree:", err.message);
        return { packageJsonPaths: [], treeData: null };
    }
}

async function fetchPackageJson(octokit, owner, repo, path) {
    try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path,
        });
        const content = JSON.parse(Buffer.from(data.content, "base64").toString());
        return { path, content, error: null };
    } catch (err) {
        console.warn(`Failed to fetch/parse ${path}:`, err.message);
        return { path, content: null, error: err.message };
    }
}

async function fetchAllPackages(octokit, owner, repo) {
    const { packageJsonPaths, treeData } = await findAllPackageJsonPaths(octokit, owner, repo);
    const fileTree = treeData ? buildFileTree(treeData) : null;

    if (packageJsonPaths.length === 0) {
        return { packages: [], fileTree };
    }

    const results = await Promise.all(
        packageJsonPaths.map(path => fetchPackageJson(octokit, owner, repo, path))
    );

    const packages = results.filter(pkg => pkg.content !== null);
    return { packages, fileTree };
}

function aggregateDependencies(packages) {
    const ignoreList = [
        'eslint', 'prettier', 'husky', 'lint-staged', 'stylelint',
        'typescript', 'vite', 'webpack', 'rollup', 'parcel', 'esbuild',
        'babel', 'tsc', 'ts-node', 'tsx', 'nodemon', 'concurrently',
        'jest', 'mocha', 'chai', 'vitest', 'cypress', 'playwright', 'supertest',
        'postcss', 'autoprefixer', 'sass', 'less', 'dotenv', 'cross-env', 'rimraf',
        'black', 'flake8', 'pylint', 'mypy', 'isort', 'autopep8', 'bandit',
        'pytest', 'coverage', 'tox', 'mock', 'hypothesis', 'pytest-cov',
        'setuptools', 'wheel', 'twine', 'build',
        'python-dotenv', 'pip-tools', 'virtualenv', 'pre-commit'
    ];

    const depsSet = new Set();

    for (const pkg of packages) {
        const { content } = pkg;
        if (content?.dependencies) {
            Object.keys(content.dependencies).forEach(dep => {
                if (dep.startsWith('@types/')) return;
                if (dep.startsWith('@babel/')) return;
                if (dep.startsWith('@vitejs/')) return;
                if (dep.startsWith('types-')) return;
                if (ignoreList.includes(dep)) return;
                depsSet.add(dep);
            });
        }
    }

    return Array.from(depsSet).sort();
}

function buildFileTree(treeData, maxDepth = 4) {
    const fileTree = {};

    if (!treeData?.tree || !Array.isArray(treeData.tree)) {
        return fileTree;
    }

    for (const item of treeData.tree) {
        if (
            item.path === "node_modules" ||
            item.path.startsWith("node_modules/") ||
            item.path === ".git" ||
            item.path.startsWith(".git/")
        ) {
            continue;
        }

        const parts = item.path.split("/");
        const depth = Math.min(parts.length, maxDepth);
        let current = fileTree;

        for (let i = 0; i < depth; i++) {
            const part = parts[i];
            const isLastLevel = i === depth - 1;
            const isActualFile = i === parts.length - 1 && item.type === "blob";

            if (isLastLevel && isActualFile) {
                current[part] = null;
            } else {
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        }
    }

    return fileTree;
}

function aggregateScripts(packages) {
    const scriptsMap = new Map();

    for (const pkg of packages) {
        const { path, content } = pkg;
        const packageDir = path === "package.json" ? "(root)" : path.replace("/package.json", "");

        if (content?.scripts) {
            for (const [name, command] of Object.entries(content.scripts)) {
                if (!scriptsMap.has(name)) {
                    scriptsMap.set(name, []);
                }
                scriptsMap.get(name).push({ package: packageDir, command });
            }
        }
    }

    return scriptsMap;
}

export async function runBot(payload) {
    try {
        const installationId = payload.installation.id;
        const owner = payload.repository.owner.login;
        const repo = payload.repository.name;

        const octokit = await getOctokit(installationId);

        const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: "README.md",
        });

        const content = Buffer.from(data.content, "base64").toString();
        const { packages, fileTree } = await fetchAllPackages(octokit, owner, repo);
        const dependencies = aggregateDependencies(packages);
        const scripts = aggregateScripts(packages);
        const projectType = packages.length > 0 ? "node" : "unknown";

        const context = {
            packages,
            dependencies,
            scripts,
            fileTree,
            username: owner,
            isMonorepo: packages.length > 1,
        };

        const newReadme = processReadme(content, projectType, context);

        if (newReadme === content) {
            console.log("No changes needed");
            return;
        }

        await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: "README.md",
            message: "Auto-update README",
            content: Buffer.from(newReadme).toString("base64"),
            sha: data.sha,
        });

        console.log("README updated successfully");

    } catch (err) {
        console.error("Bot error:", err.message);
    }
}