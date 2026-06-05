import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import { runBot } from "./bot.js";
import { trackInstall, trackUninstall, trackEvent, getStats } from "./analytics.js";

dotenv.config();

const app = express();

// Parse JSON with rawBody capturing for webhook verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

function verifySignature(req) {
    const signature = req.headers["x-hub-signature-256"];
    if (!signature) {
        return false;
    }
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
        console.error("WEBHOOK_SECRET environment variable is not defined");
        return false;
    }
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(req.rawBody || "").digest("hex");
    
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch (err) {
        return false;
    }
}

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.get("/stats", async (req, res) => {
    try {
        const stats = await getStats();
        res.json(stats);
    } catch (err) {
        console.error("Stats error:", err.message);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

app.post("/webhook", async (req, res) => {
    if (!verifySignature(req)) {
        console.warn("Invalid webhook signature received");
        return res.status(401).send("Unauthorized: Invalid signature");
    }

    const event = req.headers["x-github-event"];

    try {
        if (event === "installation") {
            const { action, installation } = req.body;

            if (action === "created") {
                await trackInstall(
                    installation.id,
                    installation.account.login,
                    installation.account.type
                );
                await trackEvent("installation", { action, installationId: installation.id });
            } else if (action === "deleted") {
                await trackUninstall(installation.id);
                await trackEvent("installation", { action, installationId: installation.id });
            }
        }

        if (event === "push") {
            const { repository, installation, ref } = req.body;
            const isDefaultBranch = ref === `refs/heads/${repository.default_branch}`;

            if (isDefaultBranch) {
                console.log(`Push event received on default branch (${repository.default_branch})`);
                await trackEvent("push", {
                    repo: repository.full_name,
                    installationId: installation.id
                });
                await runBot(req.body);
            } else {
                console.log(`Skipping push on non-default branch: ${ref}`);
            }
        }
    } catch (err) {
        console.error("Webhook error:", err.message);
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});