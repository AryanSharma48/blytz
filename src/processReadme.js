import getDefaultContent from "./template.js";


//Core engine: processes README content and returns updated version
export default function processReadme(content, projectType, context = {}) {

    // Split into sections
    const sections = content.split("## ");
    const sectionMap = {};

    // Extract intro (title + description)
    const intro = sections[0].trim();

    // Parse sections
    sections.slice(1).forEach(section => {
        const lines = section.split("\n");
        const title = lines[0].trim().toLowerCase();
        const body = lines.slice(1).join("\n").trim();

        sectionMap[title] = body;
    });

    // Required sections
    const requiredSections = [
        "description",
        "installation",
        "usage",
        "dependencies",
        "folder structure",
        "license",
        "built by"
    ];

    // Auto-managed sections (safe to update)
    const autoManaged = [
        "installation",
        "usage",
        "dependencies",
        "folder structure"
    ];

    // Diff function
    const isDifferent = (a = "", b = "") => a.trim() !== b.trim();

    // Add / update sections
    requiredSections.forEach(section => {
        const newContent = getDefaultContent(section, projectType, context);

        if (!(section in sectionMap)) {
            sectionMap[section] = newContent;
        } else if (autoManaged.includes(section)) {
            if (isDifferent(sectionMap[section], newContent)) {
                sectionMap[section] = newContent;
            }
        }
    });

    // Format title
    const formatTitle = (title) =>
        title.split(" ")
            .map(word => word[0].toUpperCase() + word.slice(1))
            .join(" ");

    // Rebuild README
    let newReadme = intro ? intro + "\n\n" : "";

    // Ordered sections
    requiredSections.forEach(section => {
        newReadme += `## ${formatTitle(section)}\n\n${sectionMap[section]}\n\n`;
    });

    // Extra sections (preserve user content)
    Object.keys(sectionMap).forEach(section => {
        if (!requiredSections.includes(section)) {
            newReadme += `## ${formatTitle(section)}\n\n${sectionMap[section]}\n\n`;
        }
    });

    return newReadme.trim();
}