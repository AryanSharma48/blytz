// recursively builds a tree string from a file tree object
function generateTree(fileTree, prefix = "") {
    if (!fileTree || typeof fileTree !== "object") return "";

    const entries = Object.entries(fileTree);
    let tree = "";

    entries.forEach(([name, value], index) => {
        if (name === "node_modules" || name === ".git") return;

        const isLast = index === entries.length - 1;
        const connector = isLast ? "└── " : "├── ";
        tree += `${prefix}${connector}${name}\n`;

        // recurse into directories
        if (value && typeof value === "object") {
            tree += generateTree(value, prefix + (isLast ? "    " : "│   "));
        }
    });

    return tree;
}

export default function getProjectStructure(fileTree) {
    return "```\n" + generateTree(fileTree) + "```";
}
