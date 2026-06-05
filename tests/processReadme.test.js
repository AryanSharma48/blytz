import test from "node:test";
import assert from "node:assert";
import processReadme from "../src/processReadme.js";

test("processReadme preserves casing and content of custom sections", () => {
    const inputReadme = `
# Project Title

Intro description.

## Installation

Follow these steps to install the project:

\`\`\`bash
npm install
\`\`\`

## MY CUSTOM Section
Some custom text here.

## FUTURE PLANS
- Add more features
    `;

    const context = {
        projectName: "Project Title",
        descriptionContent: "Intro description.",
        packages: [{ path: "package.json", content: {} }],
        dependencies: [],
        scripts: new Map(),
        fileTree: {},
        licenseName: "MIT License",
        username: "testuser"
    };

    const result = processReadme(inputReadme, "node", context);

    // Verify custom section titles are preserved exactly
    assert.ok(result.includes("## MY CUSTOM Section"));
    assert.ok(result.includes("## FUTURE PLANS"));
    assert.ok(result.includes("Some custom text here."));
    assert.ok(result.includes("- Add more features"));
});

test("processReadme adds missing required sections", () => {
    const inputReadme = `
# My Project

An intro.
    `;

    const context = {
        projectName: "My Project",
        descriptionContent: "An intro.",
        packages: [{ path: "package.json", content: {} }],
        dependencies: ["dotenv"],
        scripts: new Map(),
        fileTree: { "index.js": null },
        licenseName: "MIT License",
        username: "testuser"
    };

    const result = processReadme(inputReadme, "node", context);

    // Check all required sections are present
    assert.ok(result.includes("## Installation"));
    assert.ok(result.includes("## Usage"));
    assert.ok(result.includes("## Dependencies"));
    assert.ok(result.includes("## Folder Structure"));
    assert.ok(result.includes("## License"));
    assert.ok(result.includes("## Built By"));
});

test("processReadme updates auto-managed sections if they differ", () => {
    const inputReadme = `
# My Project

Intro.

## Dependencies

Old dependencies text.
    `;

    const context = {
        projectName: "My Project",
        descriptionContent: "Intro.",
        packages: [{ path: "package.json", content: {} }],
        dependencies: ["dotenv", "express"],
        scripts: new Map(),
        fileTree: {},
        licenseName: "MIT License",
        username: "testuser"
    };

    const result = processReadme(inputReadme, "node", context);

    // Old dependencies text should be replaced with updated dependencies
    assert.ok(!result.includes("Old dependencies text."));
    assert.ok(result.includes("- dotenv"));
    assert.ok(result.includes("- express"));
});
