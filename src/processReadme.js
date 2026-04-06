import getDefaultContent from "./template.js";


//Core engine: processes README content and returns updated version
export default function processReadme(content, projectType, context = {}) {
    const { titleContent = "" } = context ?? {};

    const normalizedContent = (content || "").replace(/^##(?=\S)/gm, "## ");

    // Split into sections
    const sections = normalizedContent.split("## ");
    const sectionMap = {};

    // Extract intro (title + description)
    const intro = sections[0].trim();
    const finalIntro = titleContent ? `# ${titleContent}` : intro;

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
        const currentContent = (sectionMap[section] || "").trim();

        if (!currentContent) {
            sectionMap[section] = newContent;
        } else if (autoManaged.includes(section)) {
            if (isDifferent(currentContent, newContent)) {
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
    let newReadme = finalIntro ? finalIntro + "\n\n" : "";

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
