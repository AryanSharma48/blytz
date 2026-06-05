import test from "node:test";
import assert from "node:assert";
import {
    DEFAULT_IGNORED_NAMES,
    collectNodeDependencies,
    collectPythonDependencies,
    collectScripts,
    getLicenseName,
    parseGitignoreContent,
    isIgnoredByGitignore
} from "../src/readmeContext.js";

test("DEFAULT_IGNORED_NAMES includes new frameworks/temp folders", () => {
    assert.ok(DEFAULT_IGNORED_NAMES.has(".next"));
    assert.ok(DEFAULT_IGNORED_NAMES.has(".nuxt"));
    assert.ok(DEFAULT_IGNORED_NAMES.has("coverage"));
    assert.ok(DEFAULT_IGNORED_NAMES.has(".turbo"));
});

test("collectNodeDependencies collects alphabetically sorted dependencies", () => {
    const packages = [
        {
            content: {
                dependencies: {
                    express: "^4.17.1",
                    dotenv: "^10.0.0"
                }
            }
        }
    ];
    const deps = collectNodeDependencies(packages);
    assert.deepStrictEqual(deps, ["dotenv", "express"]);
});

test("collectPythonDependencies parses requirements.txt correctly", () => {
    const files = [
        {
            path: "requirements.txt",
            content: "requests==2.26.0\n# comment\nflask>=2.0\n"
        }
    ];
    const deps = collectPythonDependencies(files);
    assert.deepStrictEqual(deps, ["flask", "requests"]);
});

test("collectPythonDependencies parses pyproject.toml correctly", () => {
    const files = [
        {
            path: "pyproject.toml",
            content: `
[tool.poetry.dependencies]
python = "^3.8"
requests = "^2.26.0"
numpy = { version = "^1.21" }
            `
        }
    ];
    const deps = collectPythonDependencies(files);
    assert.deepStrictEqual(deps, ["numpy", "requests"]);
});

test("collectPythonDependencies parses Pipfile correctly", () => {
    const files = [
        {
            path: "Pipfile",
            content: `
[packages]
requests = "*"
django = "==3.2"
            `
        }
    ];
    const deps = collectPythonDependencies(files);
    assert.deepStrictEqual(deps, ["django", "requests"]);
});

test("collectScripts collects dev, test, start, build, lint but skips others", () => {
    const packages = [
        {
            path: "package.json",
            content: {
                scripts: {
                    start: "node index.js",
                    dev: "nodemon index.js",
                    test: "jest",
                    build: "webpack",
                    lint: "eslint",
                    invalid: "echo invalid"
                }
            }
        }
    ];
    const scripts = collectScripts(packages);
    assert.ok(scripts.has("start"));
    assert.ok(scripts.has("dev"));
    assert.ok(scripts.has("test"));
    assert.ok(scripts.has("build"));
    assert.ok(scripts.has("lint"));
    assert.ok(!scripts.has("invalid"));
});

test("getLicenseName extracts correct name from license text", () => {
    assert.strictEqual(getLicenseName("MIT License\nCopyright (c) 2026"), "MIT License");
    assert.strictEqual(getLicenseName("Apache License\nVersion 2.0, January 2004"), "Apache License 2.0");
    assert.strictEqual(getLicenseName("Copyright (c) 2026\nSome other text"), "Copyright (c) 2026");
});

test("parseGitignoreContent and isIgnoredByGitignore check matches correctly", () => {
    const content = `
node_modules/
*.log
    `;
    const rules = parseGitignoreContent(content);
    assert.ok(isIgnoredByGitignore("node_modules/test.js", true, rules));
    assert.ok(isIgnoredByGitignore("error.log", false, rules));
    assert.ok(!isIgnoredByGitignore("src/index.js", false, rules));
});
