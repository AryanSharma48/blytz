import { getOctokit } from "./github.js";
import processReadme from "../src/processReadme.js";
import {
    buildRemoteFileTree,
    collectNodeDependencies,
    collectPythonDependencies,
    collectScripts,
    getLicenseName,
    parseGitignoreContent
} from "../src/readmeContext.js";

async function findProjectFiles(octokit, owner, repo) {
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

        const requirementsPaths = treeData.tree
            .filter(item =>
                item.type === "blob" &&
                (item.path.endsWith("requirements.txt") ||
                 item.path.endsWith("pyproject.toml") ||
                 item.path.endsWith("Pipfile")) &&
                !item.path.includes("node_modules/") &&
                !item.path.includes(".git/") &&
                !item.path.includes("venv/") &&
                !item.path.includes(".venv/")
            )
            .map(item => item.path);

        return { packageJsonPaths, requirementsPaths, treeData };
    } catch (err) {
        console.error("Error scanning repository tree:", err.message);
        return { packageJsonPaths: [], requirementsPaths: [], treeData: null };
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

async function fetchRequirementsFile(octokit, owner, repo, path) {
    try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path,
        });
        const content = Buffer.from(data.content, "base64").toString();
        return { path, content, error: null };
    } catch (err) {
        console.warn(`Failed to fetch ${path}:`, err.message);
        return { path, content: null, error: err.message };
    }
}

async function fetchGitignoreFile(octokit, owner, repo, gitignorePath) {
    try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: gitignorePath,
        });
        const content = Buffer.from(data.content, "base64").toString();
        return { path: gitignorePath, content, error: null };
    } catch (err) {
        console.warn(`Failed to fetch ${gitignorePath}:`, err.message);
        return { path: gitignorePath, content: null, error: err.message };
    }
}

function findLicensePath(treeData) {
    const licenseEntry = treeData?.tree?.find(item =>
        item.type === "blob" &&
        /^LICENSE(?:\.[^/]+)?$/i.test(item.path)
    );

    return licenseEntry?.path || null;
}

async function fetchLicenseName(octokit, owner, repo, treeData) {
    const licensePath = findLicensePath(treeData);

    if (!licensePath) {
        return "";
    }

    try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: licensePath,
        });

        const content = Buffer.from(data.content, "base64").toString();
        return getLicenseName(content);
    } catch (err) {
        console.warn(`Failed to fetch license file ${licensePath}:`, err.message);
        return "";
    }
}

async function fetchGitignoreRules(octokit, owner, repo, treeData) {
    const gitignorePaths = (treeData?.tree || [])
        .filter(item => item.type === "blob" && item.path.endsWith(".gitignore"))
        .map(item => item.path)
        .sort((left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right));

    if (gitignorePaths.length === 0) {
        return [];
    }

    const gitignoreFiles = await Promise.all(
        gitignorePaths.map(gitignorePath => fetchGitignoreFile(octokit, owner, repo, gitignorePath))
    );

    return gitignoreFiles
        .filter(file => file.content !== null)
        .flatMap(file => {
            const baseDir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
            return parseGitignoreContent(file.content, baseDir);
        });
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

        const { packageJsonPaths, requirementsPaths, treeData } = await findProjectFiles(octokit, owner, repo);
        const content = Buffer.from(data.content, "base64").toString();
        const gitignoreRules = treeData ? await fetchGitignoreRules(octokit, owner, repo, treeData) : [];
        const fileTree = treeData ? buildRemoteFileTree(treeData, gitignoreRules) : null;
        
        const packages = packageJsonPaths.length > 0
            ? (await Promise.all(packageJsonPaths.map(path => fetchPackageJson(octokit, owner, repo, path))))
                .filter(pkg => pkg.content !== null)
            : [];
        
        const requirementFiles = packages.length === 0 && requirementsPaths.length > 0
            ? (await Promise.all(requirementsPaths.map(path => fetchRequirementsFile(octokit, owner, repo, path))))
                .filter(file => file.content !== null)
            : [];
        
        const isNodeProject = packages.length > 0;
        const isPythonProject = !isNodeProject && requirementFiles.length > 0;
        
        const dependencies = isNodeProject
            ? collectNodeDependencies(packages)
            : collectPythonDependencies(requirementFiles);
            
        const scripts = isNodeProject ? collectScripts(packages) : new Map();
        const projectType = isNodeProject ? "node" : (isPythonProject ? "python" : "unknown");

        // Remote package manager detection
        const hasYarnLock = treeData?.tree?.some(item => item.path === "yarn.lock");
        const hasPnpmLock = treeData?.tree?.some(item => item.path === "pnpm-lock.yaml");
        const hasBunLock = treeData?.tree?.some(item => item.path === "bun.lockb" || item.path === "bun.lock");
        let packageManager = "npm";
        if (hasYarnLock) packageManager = "yarn";
        else if (hasPnpmLock) packageManager = "pnpm";
        else if (hasBunLock) packageManager = "bun";

        // License fallback
        let licenseName = await fetchLicenseName(octokit, owner, repo, treeData);
        if (!licenseName && packages.length > 0) {
            const rootPkg = packages.find(pkg => pkg.path === "package.json");
            if (rootPkg && rootPkg.content?.license) {
                const pkgLicense = rootPkg.content.license;
                licenseName = typeof pkgLicense === "object" ? (pkgLicense.type || "") : pkgLicense;
            }
        }

        const context = {
            packages: isNodeProject ? packages : requirementFiles,
            dependencies,
            scripts,
            fileTree,
            licenseName,
            username: owner,
            projectName: repo,
            isMonorepo: isNodeProject && packages.length > 1,
            packageManager
        };

        const newReadme = processReadme(content, projectType, context);

        if (newReadme === content) {
            console.log("No changes needed");
            return;
        }

        // --- PULL REQUEST WORKFLOW ---
        const branchName = "blytz-readme-update";
        const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
        const defaultBranch = repoData.default_branch;

        // Get default branch SHA
        const { data: refData } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/heads/{ref}", {
            owner,
            repo,
            ref: defaultBranch,
        });
        const baseSha = refData.object.sha;

        // Check if branch already exists
        let branchExists = false;
        try {
            await octokit.request("GET /repos/{owner}/{repo}/git/ref/heads/{ref}", {
                owner,
                repo,
                ref: branchName,
            });
            branchExists = true;
        } catch (e) {
            // Branch doesn't exist
        }

        if (!branchExists) {
            await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
                owner,
                repo,
                ref: `refs/heads/${branchName}`,
                sha: baseSha,
            });
        }

        let readmeSha = data.sha;
        if (branchExists) {
            try {
                const { data: branchReadmeData } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                    owner,
                    repo,
                    path: "README.md",
                    ref: branchName,
                });
                const branchContent = Buffer.from(branchReadmeData.content, "base64").toString();
                if (branchContent === newReadme) {
                    console.log("Branch already has the updated README");
                    return;
                }
                readmeSha = branchReadmeData.sha;
            } catch (err) {
                // If it doesn't exist on branch yet, fall back to base
            }
        }

        // Commit content to new branch
        await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: "README.md",
            message: "docs: Auto-update README.md",
            content: Buffer.from(newReadme).toString("base64"),
            sha: readmeSha,
            branch: branchName,
        });

        // Check if open PR already exists
        const { data: pulls } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
            owner,
            repo,
            head: `${owner}:${branchName}`,
            base: defaultBranch,
            state: "open",
        });

        if (pulls.length === 0) {
            await octokit.request("POST /repos/{owner}/{repo}/pulls", {
                owner,
                repo,
                title: "docs: Auto-update README.md",
                body: "This is an automated pull request from **Blytz** to keep your README.md synchronized with your project metadata and codebase structure.",
                head: branchName,
                base: defaultBranch,
            });
            console.log("Pull Request created successfully");
        } else {
            console.log("README updated on branch; Pull Request already exists");
        }

    } catch (err) {
        console.error("Bot error:", err.message);
    }
}
