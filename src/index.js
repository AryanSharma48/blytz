import getDefaultContent from "./template.js";
import { detectProjectType } from "./projectReader.js";

export function generateReadme(input = {}) {
    const {
        readmeContent = "",
        packageJson = null,
        fileTree = null,
        username = "Unknown",
        projectName = null,
        hasPackageJson = false,
        hasRequirementsTxt = false
    } = input ?? {};

    const resolvedProjectName = projectName || packageJson?.name || "this project";

    const context = {
        packageJson,
        fileTree,
        username,
        projectName: resolvedProjectName,
        hasPackageJson,
        hasRequirementsTxt
    };

    const projectType = detectProjectType(context);

    // parse existing readme into sections
    const sections = (readmeContent || "").split("## ");
    const sectionMap = {};
    const intro = sections[0].trim();

    sections.slice(1).forEach(section => {
        const lines = section.split("\n");
        const title = lines[0].trim().toLowerCase();
        const content = lines.slice(1).join("\n").trim();
        sectionMap[title] = content;
    });

    const requiredSections = ["description", "installation", "usage", "dependencies", "folder structure", "built by"];
    const autoManagedSections = ["installation", "usage", "dependencies", "folder structure"];

    // fill in missing sections or update auto-managed ones
    requiredSections.forEach(section => {
        const newContent = getDefaultContent(section, projectType, context);
        if (!(section in sectionMap)) {
            sectionMap[section] = newContent;
        } else if (autoManagedSections.includes(section) && sectionMap[section].trim() !== newContent.trim()) {
            sectionMap[section] = newContent;
        }
    });

    const formatTitle = title => title.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

    // build the final readme
    let newReadme = intro ? intro + "\n\n" : "";
    requiredSections.forEach(section => {
        newReadme += `## ${formatTitle(section)}\n${sectionMap[section]}\n\n`;
    });

    // append any extra sections the user had
    Object.keys(sectionMap).forEach(section => {
        if (!requiredSections.includes(section)) {
            newReadme += `## ${formatTitle(section)}\n\n ${sectionMap[section]}\n\n`;
        }
    });

    return { content: newReadme, changed: readmeContent !== newReadme };
}

export { detectProjectType } from "./projectReader.js";
export { default as getDefaultContent } from "./template.js";
export { default as getProjectStructure } from "./fileTree.js";