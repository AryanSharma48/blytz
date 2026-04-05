import getProjectStructure from "./fileTree.js";

export default function getDefaultContent(section, projectType, context = {}) {
    const {
        packageJson = null,
        fileTree = null,
        username = "Unknown",
        projectName = "this project"
    } = context ?? {};

    const safeProjectType = projectType || "unknown";
    const safeSection = (section || "").toLowerCase().trim();

    switch (safeSection) {
        case "description":
            return getDescriptionContent(safeProjectType, projectName);
        case "installation":
            return getInstallationContent(safeProjectType);
        case "usage":
            return getUsageContent(safeProjectType, packageJson);
        case "dependencies":
            return getDependenciesContent(packageJson);
        case "folder structure":
            return getFolderStructureContent(fileTree);
        case "license":
            return "This project is licensed under the MIT License.";
        case "built by":
            return `Built with ❤️ by @${(username || "Unknown").trim()}`;
        default:
            return "";
    }
}

function getDescriptionContent(projectType, projectName) {
    const name = projectName || "this project";
    if (projectType === "node") return `${name} is a Node.js application. Add a brief description of its purpose and what problem it solves.`;
    if (projectType === "python") return `${name} is a Python project. Add a brief description of its purpose and what problem it solves.`;
    return `${name} - Add a brief description of your project, its purpose, and what problem it solves.`;
}

function getInstallationContent(projectType) {
    if (projectType === "node") return "Follow these steps to install the project:\n\n```bash\nnpm install\n```";
    if (projectType === "python") return "Install dependencies using:\n\n```bash\npip install -r requirements.txt\n```";
    return "Add installation instructions here.";
}

function getUsageContent(projectType, packageJson) {
    if (projectType === "node") {
        const scripts = extractScripts(packageJson);
        if (scripts.length > 0) {
            const commands = scripts.map(s => s === "start" ? "npm start" : `npm run ${s}`).join("\n");
            return `You can run the following scripts:\n\n\`\`\`bash\n${commands}\n\`\`\``;
        }
        return "Run the project using:\n\n```bash\nnpm start\n```";
    }
    if (projectType === "python") return "Run the project using:\n\n```bash\npython main.py\n```";
    return "Add usage instructions here.";
}

function getDependenciesContent(packageJson) {
    const deps = extractDependencies(packageJson);
    if (deps.length > 0) return "This project uses the following dependencies:\n\n" + deps.map(d => `- ${d}`).join("\n");
    return "No dependencies found.";
}

function getFolderStructureContent(fileTree) {
    if (!fileTree || typeof fileTree !== "object" || Object.keys(fileTree).length === 0) {
        return "Project structure:\n\n```\n(No file tree provided)\n```";
    }
    return "Project structure:\n\n" + getProjectStructure(fileTree);
}

// safely pulls dependency names from package.json
function extractDependencies(packageJson) {
    if (!packageJson || typeof packageJson !== "object") return [];
    try {
        const deps = packageJson.dependencies;
        return (deps && typeof deps === "object") ? Object.keys(deps) : [];
    } catch { return []; }
}

// safely pulls script names from package.json
function extractScripts(packageJson) {
    if (!packageJson || typeof packageJson !== "object") return [];
    try {
        const scripts = packageJson.scripts;
        return (scripts && typeof scripts === "object") ? Object.keys(scripts) : [];
    } catch { return []; }
}