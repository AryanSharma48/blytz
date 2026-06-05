import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/analytics.json");

const DEFAULT_DATA = {
    installs: [],
    events: []
};

// Queue for serializing read-modify-write database operations to prevent race conditions
let executionQueue = Promise.resolve();

async function enqueue(operation) {
    return new Promise((resolve, reject) => {
        executionQueue = executionQueue.then(async () => {
            try {
                const result = await operation();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    });
}

async function ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
    }
}

async function readData() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        if (err.code === "ENOENT") {
            return { ...DEFAULT_DATA };
        }
        if (err instanceof SyntaxError) {
            console.error("Invalid JSON in analytics file, resetting...");
            return { ...DEFAULT_DATA };
        }
        throw err;
    }
}

async function writeData(data) {
    await ensureDataDir();
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function trackInstall(installationId, accountLogin, accountType) {
    return enqueue(async () => {
        const data = await readData();

        const exists = data.installs.some(i => i.installationId === installationId);
        if (!exists) {
            data.installs.push({
                installationId,
                accountLogin,
                accountType,
                installedAt: new Date().toISOString()
            });
            await writeData(data);
        }

        return !exists;
    });
}

export async function trackUninstall(installationId) {
    return enqueue(async () => {
        const data = await readData();
        const initialLength = data.installs.length;

        data.installs = data.installs.filter(i => i.installationId !== installationId);

        if (data.installs.length !== initialLength) {
            await writeData(data);
            return true;
        }
        return false;
    });
}

export async function trackEvent(eventType, payload = {}) {
    return enqueue(async () => {
        const data = await readData();

        data.events.push({
            type: eventType,
            payload,
            timestamp: new Date().toISOString()
        });

        await writeData(data);
    });
}

export async function getStats() {
    // Reading statistics doesn't modify data, but reading through the queue ensures we don't read partial data during writes
    return enqueue(async () => {
        const data = await readData();

        const eventCounts = data.events.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {});

        return {
            totalInstalls: data.installs.length,
            totalEvents: data.events.length,
            eventsByType: eventCounts,
            recentEvents: data.events.slice(-10).reverse()
        };
    });
}
