export const DEFAULT_IGNORED_NAMES = new Set([
    "node_modules",
    ".git",
    ".agent",
    "dist",
    "build",
    "out",
    "target",
    "venv",
    ".venv",
    "__pycache__",
    ".idea",
    ".vscode",
    ".DS_Store",
    "Thumbs.db",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production"
]);

export function collectNodeDependencies(packages = []) {
    const dependencies = new Set();

    for (const pkg of packages) {
        for (const dependency of Object.keys(pkg?.content?.dependencies || {})) {
            dependencies.add(dependency);
        }
    }

    return Array.from(dependencies).sort((left, right) => left.localeCompare(right));
}

export function collectPythonDependencies(files = []) {
    const dependencies = new Set();

    for (const file of files) {
        if (!file?.content) {
            continue;
        }

        file.content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"))
            .filter(line => !line.startsWith("-"))
            .map(line => line.split(";")[0].trim())
            .map(line => line.split(/[=<>!~]/)[0].trim())
            .filter(Boolean)
            .forEach(dependency => dependencies.add(dependency));
    }

    return Array.from(dependencies).sort((left, right) => left.localeCompare(right));
}

export function collectScripts(packages = []) {
    const scripts = new Map();

    for (const pkg of packages) {
        const packageDir = pkg.path === "package.json" ? "(root)" : pkg.path.replace("/package.json", "");

        for (const [name, command] of Object.entries(pkg?.content?.scripts || {})) {

            if(name !=="start"){
                continue;
            }

            if (!scripts.has(name)) {
                scripts.set(name, []);
            }

            scripts.get(name).push({ package: packageDir, command });
        }
    }

    return scripts;
}

export function getLicenseName(licenseContent = "") {
    const firstLine = licenseContent
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(Boolean);

    return firstLine || "";
}

function escapeRegex(value) {
    return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegex(pattern) {
    let regex = "";

    for (let index = 0; index < pattern.length; index += 1) {
        const char = pattern[index];
        const nextChar = pattern[index + 1];

        if (char === "*") {
            if (nextChar === "*") {
                regex += ".*";
                index += 1;
            } else {
                regex += "[^/]*";
            }
            continue;
        }

        if (char === "?") {
            regex += "[^/]";
            continue;
        }

        regex += escapeRegex(char);
    }

    return regex;
}

export function parseGitignoreContent(content, baseDir = "") {
    return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"))
        .map(line => {
            const negated = line.startsWith("!");
            const rawPattern = negated ? line.slice(1).trim() : line;

            if (!rawPattern) {
                return null;
            }

            const directoryOnly = rawPattern.endsWith("/");
            const normalizedPattern = rawPattern.replace(/\/+$/, "").replace(/\\/g, "/");

            if (!normalizedPattern) {
                return null;
            }

            const anchored = normalizedPattern.startsWith("/");
            const matcherPattern = anchored ? normalizedPattern.slice(1) : normalizedPattern;

            return {
                baseDir: baseDir.replace(/\\/g, "/"),
                negated,
                directoryOnly,
                hasSlash: matcherPattern.includes("/"),
                regex: new RegExp(`^${globToRegex(matcherPattern)}(?:/.*)?$`),
                basenameRegex: new RegExp(`^${globToRegex(matcherPattern)}$`)
            };
        })
        .filter(Boolean);
}

export function isIgnoredByGitignore(relativePath, isDirectory, gitignoreRules = []) {
    const normalizedPath = relativePath.replace(/\\/g, "/");
    let ignored = false;

    for (const rule of gitignoreRules) {
        if (rule.directoryOnly && !isDirectory) {
            continue;
        }

        if (rule.baseDir && normalizedPath !== rule.baseDir && !normalizedPath.startsWith(`${rule.baseDir}/`)) {
            continue;
        }

        const scopedPath = rule.baseDir
            ? normalizedPath.slice(rule.baseDir.length).replace(/^\/+/, "")
            : normalizedPath;
        const pathParts = scopedPath.split("/");
        const matches = rule.hasSlash
            ? rule.regex.test(scopedPath)
            : pathParts.some(part => rule.basenameRegex.test(part));

        if (matches) {
            ignored = !rule.negated;
        }
    }

    return ignored;
}

export function parseLocalGitignore(fs, gitignorePath, baseDir = "") {
    if (!fs.existsSync(gitignorePath)) {
        return [];
    }

    return parseGitignoreContent(fs.readFileSync(gitignorePath, "utf-8"), baseDir);
}

export function buildLocalFileTree(fs, path, dirPath, rootDir = dirPath, inheritedGitignoreRules = [], depth = 0, maxDepth = 3) {
    if (depth >= maxDepth) {
        return {};
    }

    const relativeDir = path.relative(rootDir, dirPath).replace(/\\/g, "/");
    const localGitignoreRules = parseLocalGitignore(
        fs,
        path.join(dirPath, ".gitignore"),
        relativeDir === "" ? "" : relativeDir
    );
    const gitignoreRules = [...inheritedGitignoreRules, ...localGitignoreRules];
    const tree = {};
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => {
            if (DEFAULT_IGNORED_NAMES.has(entry.name)) {
                return false;
            }

            const entryPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(rootDir, entryPath);

            return !isIgnoredByGitignore(relativePath, entry.isDirectory(), gitignoreRules);
        })
        .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            tree[entry.name] = buildLocalFileTree(fs, path, entryPath, rootDir, gitignoreRules, depth + 1, maxDepth);
        } else {
            tree[entry.name] = null;
        }
    }

    return tree;
}

export function buildRemoteFileTree(treeData, gitignoreRules = [], maxDepth = 3) {
    const fileTree = {};

    if (!treeData?.tree || !Array.isArray(treeData.tree)) {
        return fileTree;
    }

    for (const item of treeData.tree) {
        const parts = item.path.split("/");
        const name = parts[parts.length - 1];
        const isDirectory = item.type === "tree";

        if (DEFAULT_IGNORED_NAMES.has(name) || isIgnoredByGitignore(item.path, isDirectory, gitignoreRules)) {
            continue;
        }

        if (parts.length > maxDepth) {
            continue;
        }

        let current = fileTree;

        for (let index = 0; index < parts.length; index += 1) {
            const part = parts[index];
            const isFile = index === parts.length - 1 && item.type === "blob";

            if (isFile) {
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
