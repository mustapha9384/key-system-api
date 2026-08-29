const express = require('express');
const crypto = require('crypto');
const { Octokit } = require("@octokit/rest");

const app = express();
app.use(express.json());

// جلب التوكن من Environment Variables بالأمان
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "mustapha9384";
const REPO = "main.lua"; // اسم Repo السكربت الذي يحتوي على keys.json
const FILE_PATH = "keys.json";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.get('/', (req, res) => {
    res.send("Key Generation API is Active!");
});

app.get('/generate-key', async (req, res) => {
    try {
        const rawKey = "KEY-" + crypto.randomBytes(8).toString('hex').toUpperCase();
        const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

        const { data: fileData } = await octokit.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: FILE_PATH,
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const keysList = JSON.parse(content);

        keysList.push({
            hash: hashedKey,
            createdAt: new Date().toISOString()
        });

        await octokit.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: FILE_PATH,
            message: "Add new hashed key",
            content: Buffer.from(JSON.stringify(keysList, null, 2)).toString('base64'),
            sha: fileData.sha,
        });

        res.json({ success: true, key: rawKey });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Render يحدد المنفذ تلقائياً عبر process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
