import { App } from "@octokit/app";

const app = new App({
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
});

export async function getOctokit(installationId) {
    const octokit = await app.getInstallationOctokit(installationId);
    return octokit;
}