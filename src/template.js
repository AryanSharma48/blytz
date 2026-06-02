import getProjectStructure from "./fileTree.js";

export default function getDefaultContent(section, projectType, context = {}) {
    const {
        packages = [],
        dependencies = [],
        scripts = new Map(),
        fileTree = null,
        descriptionContent = "",
        licenseName = "",
        username = "Unknown",
        projectName = "this project",
        isMonorepo = false,
        packageManager = "npm",
    } = context ?? {};

    const safeProjectType = projectType || "unknown";
    const safeSection = (section || "").toLowerCase().trim();

    switch (safeSection) {
        case "description":
            return getDescriptionContent(safeProjectType, projectName, isMonorepo, descriptionContent);
        case "installation":
            return getInstallationContent(safeProjectType, packages, isMonorepo, packageManager);
        case "usage":
            return getUsageContent(safeProjectType, scripts, isMonorepo, packageManager, packages);
        case "dependencies":
            return getDependenciesContent(dependencies, packages);
        case "folder structure":
            return getFolderStructureContent(fileTree);
        case "license":
            return getLicenseContent(licenseName);
        case "built by":
            return `Built with ❤️ by @${(username || "Unknown").trim()}`;
        default:
            return "";
    }
}

function getDescriptionContent(projectType, projectName, isMonorepo, descriptionContent) {
    if (descriptionContent) {
        return descriptionContent;
    }

    const name = projectName || "this project";
    if (projectType === "node") {
        if (isMonorepo) {
            return `${name} is a Node.js monorepo containing multiple packages. Add a brief description of its purpose and what problem it solves.`;
        }
        return `${name} is a Node.js application. Add a brief description of its purpose and what problem it solves.`;
    }
    if (projectType === "python") return `${name} is a Python project. Add a brief description of its purpose and what problem it solves.`;
    return `${name} - Add a brief description of your project, its purpose, and what problem it solves.`;
}

function getInstallationContent(projectType, packages, isMonorepo, packageManager = "npm") {
    const pm = packageManager;
    if (projectType === "node") {
        if (isMonorepo && packages.length > 1) {
            const packageList = packages
                .map(pkg => {
                    const dir = pkg.path === "package.json" ? "(root)" : pkg.path.replace("/package.json", "");
                    return `- \`${dir}\``;
                })
                .join("\n");

            let rootInstallCmd = "npm install";
            if (pm === "yarn") rootInstallCmd = "yarn install";
            else if (pm === "pnpm") rootInstallCmd = "pnpm install";
            else if (pm === "bun") rootInstallCmd = "bun install";

            const individualInstalls = packages.map(pkg => {
                const dir = pkg.path === "package.json" ? "." : pkg.path.replace("/package.json", "");
                let instCmd = "npm install";
                if (pm === "yarn") instCmd = "yarn install";
                else if (pm === "pnpm") instCmd = "pnpm install";
                else if (pm === "bun") instCmd = "bun install";
                return `cd ${dir} && ${instCmd}`;
            }).join("\n");

            return `This is a monorepo with multiple packages:\n\n${packageList}\n\nTo install all dependencies:\n\n\`\`\`bash\n# Install root dependencies\n${rootInstallCmd}\n\n# Or install dependencies in each package\n${individualInstalls}\n\`\`\``;
        }

        let installCmd = "npm install";
        if (pm === "yarn") installCmd = "yarn";
        else if (pm === "pnpm") installCmd = "pnpm install";
        else if (pm === "bun") installCmd = "bun install";
        return `Follow these steps to install the project:\n\n\`\`\`bash\n${installCmd}\n\`\`\``;
    }
    if (projectType === "python") return "Install dependencies using:\n\n```bash\npip install -r requirements.txt\n```";
    return "Add installation instructions here.";
}

function getUsageContent(projectType, scripts, isMonorepo, packageManager = "npm", packages = []) {
    const pm = packageManager;
    if (projectType === "node") {
        if (scripts instanceof Map && scripts.size > 0) {
            const scriptEntries = [];

            for (const [name, locations] of scripts) {
                let cmd = "";
                if (name === "start") {
                    if (pm === "yarn") cmd = "yarn start";
                    else if (pm === "pnpm") cmd = "pnpm start";
                    else if (pm === "bun") cmd = "bun start";
                    else cmd = "npm start";
                } else {
                    if (pm === "yarn") cmd = `yarn ${name}`;
                    else if (pm === "pnpm") cmd = `pnpm run ${name}`;
                    else if (pm === "bun") cmd = `bun run ${name}`;
                    else cmd = `npm run ${name}`;
                }

                if (isMonorepo && locations.length > 1) {
                    const packageNames = locations.map(l => l.package).join(", ");
                    scriptEntries.push(`- \`${cmd}\` (available in: ${packageNames})`);
                } else if (locations.length === 1) {
                    const prefix = isMonorepo ? ` (in ${locations[0].package})` : "";
                    scriptEntries.push(`- \`${cmd}\`${prefix}`);
                } else {
                    scriptEntries.push(`- \`${cmd}\``);
                }
            }

            return `You can run the following scripts:\n\n${scriptEntries.join("\n")}`;
        }

        let defaultStart = "npm start";
        if (pm === "yarn") defaultStart = "yarn start";
        else if (pm === "pnpm") defaultStart = "pnpm start";
        else if (pm === "bun") defaultStart = "bun start";
        return `Run the project using:\n\n\`\`\`bash\n${defaultStart}\n\`\`\``;
    }
    if (projectType === "python") return "Run the project using:\n\n```bash\npython main.py\n```";
    return "Add usage instructions here.";
}

function getDependenciesContent(dependencies, packages) {
    if (dependencies && dependencies.length > 0) {
        const isMonorepo = packages && packages.length > 1;
        const header = isMonorepo
            ? `This project uses the following dependencies (across ${packages.length} packages):\n\n`
            : "This project uses the following dependencies:\n\n";

        return header + dependencies.map(d => `- ${d}`).join("\n");
    }
    return "No dependencies found.";
}

function getLicenseContent(licenseName) {
    if (licenseName) {
        return `This project is licensed under the ${licenseName}. See the LICENSE file for details.`;
    }
    return "Add your license information here.";
}

function getFolderStructureContent(fileTree) {
    if (!fileTree || typeof fileTree !== "object" || Object.keys(fileTree).length === 0) {
        return "Project structure:\n\n```\n(No file tree provided)\n```";
    }
    return "Project structure:\n\n" + getProjectStructure(fileTree);
}
