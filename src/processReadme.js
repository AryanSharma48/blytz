import getDefaultContent from "./template.js";


//Core engine: processes README content and returns updated version
export default function processReadme(content, projectType, context = {}) {
    const { titleContent = "", descriptionContent = "", projectName = "" } = context ?? {};

    const normalizedContent = (content || "").replace(/^##(?=\S)/gm, "## ");

    // Split into sections
    const sections = normalizedContent.split("## ");
    const sectionMap = {};

    // Extract intro (title + description)
    const intro = sections[0].trim();
    const resolvedTitle = titleContent || projectName || "";
    const resolvedDescription = descriptionContent || getDefaultContent("description", projectType, context);
    const finalIntro = resolvedTitle
        ? [`# ${resolvedTitle}`, resolvedDescription].filter(Boolean).join("\n\n")
        : intro;

    // Parse sections
    sections.slice(1).forEach(section => {
        const lines = section.split("\n");
        const titleOriginal = lines[0].trim();
        const titleLower = titleOriginal.toLowerCase();
        const body = lines.slice(1).join("\n").trim();

        sectionMap[titleLower] = { originalTitle: titleOriginal, body };
    });

    // Required sections
    const requiredSections = [
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

    // Format title
    const formatTitle = (title) =>
        title.split(" ")
            .map(word => word[0].toUpperCase() + word.slice(1))
            .join(" ");

    // Add / update sections
    requiredSections.forEach(section => {
        const newContent = getDefaultContent(section, projectType, context);
        const entry = sectionMap[section];
        const currentContent = entry ? entry.body.trim() : "";

        if (!currentContent) {
            sectionMap[section] = { originalTitle: formatTitle(section), body: newContent };
        } else if (autoManaged.includes(section)) {
            if (isDifferent(currentContent, newContent)) {
                sectionMap[section] = { originalTitle: entry.originalTitle || formatTitle(section), body: newContent };
            }
        }
    });

    // Rebuild README
    let newReadme = finalIntro ? finalIntro + "\n\n" : "";

    // Ordered sections
    requiredSections.forEach(section => {
        const entry = sectionMap[section];
        newReadme += `## ${entry.originalTitle}\n\n${entry.body}\n\n`;
    });

    // Extra sections (preserve user content)
    Object.keys(sectionMap).forEach(section => {
        if (!requiredSections.includes(section)) {
            const entry = sectionMap[section];
            newReadme += `## ${entry.originalTitle}\n\n${entry.body}\n\n`;
        }
    });

    return newReadme.trim();
}
