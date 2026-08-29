const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'mustapha9384/main.lua';
const FILE_PATH = 'keys.json';

// ==========================================
// 1. واجهة المستخدم (HTML / CSS / JS)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>نظام الحصول على المفاتيح | Key System</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
            .card { background: #1e293b; border: 1px solid #334155; padding: 35px 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; max-width: 440px; width: 100%; }
            .status-badge { display: inline-block; background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; border: 1px solid rgba(34, 197, 94, 0.3); }
            h1 { font-size: 22px; margin-bottom: 10px; }
            p { color: #94a3b8; font-size: 14px; margin-bottom: 25px; line-height: 1.5; }
            .btn { background: #2563eb; color: white; border: none; padding: 14px 20px; font-size: 16px; font-weight: bold; border-radius: 10px; cursor: pointer; width: 100%; transition: all 0.3s ease; }
            .btn:hover { background: #1d4ed8; transform: translateY(-2px); }
            .btn:disabled { background: #475569; cursor: not-allowed; transform: none; }
            .key-container { margin-top: 20px; display: none; }
            .key-box { padding: 14px; background: #0f172a; border: 1px dashed #38bdf8; border-radius: 10px; font-family: monospace; font-size: 15px; color: #38bdf8; word-break: break-all; margin-bottom: 10px; }
            .copy-btn { background: #059669; color: white; border: none; padding: 10px; font-size: 14px; border-radius: 8px; cursor: pointer; width: 100%; transition: 0.2s; }
            .copy-btn:hover { background: #10b981; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="status-badge">● النظام متصل ويعمل بنجاح</div>
            <h1>مولّد المفاتيح التلقائي</h1>
            <p>اضغط على الزر أدناه لتوليد مفتاح تفعيل جديد لاستخدامه في السكربت الخاص بك.</p>            
            <button class="btn" id="genBtn" onclick="generateKey()">الحصول على مفتاح جديد</button>
            <div id="keyContainer" class="key-container">
                <div id="keyBox" class="key-box"></div>
                <button class="copy-btn" id="copyBtn" onclick="copyKey()">نسخ المفتاح 📋</button>
            </div>
        </div>

        <script>
            let currentKey = "";
            async function generateKey() {
                const btn = document.getElementById('genBtn');
                const container = document.getElementById('keyContainer');
                const keyBox = document.getElementById('keyBox');

                btn.innerText = "جاري التوليد وحفظ المفتاح...";
                btn.disabled = true;

                try {
                    const res = await fetch('/generate-key', { method: 'POST' });
                    const data = await res.json();
                    
                    if (data.success && data.key) {
                        currentKey = data.key;
                        keyBox.innerText = data.key;
                        container.style.display = 'block';
                        btn.innerText = "تم إنشاء المفتاح بنجاح! ✅";
                    } else {
                        alert("خطأ: " + (data.message || "فشل في توليد المفتاح"));
                        btn.innerText = "حاول مرة أخرى";
                        btn.disabled = false;
                    }
                } catch (err) {
                    alert("حدث خطأ أثناء الاتصال بالسيرفر!");
                    btn.innerText = "حاول مرة أخرى";
                    btn.disabled = false;
                }
            }

            function copyKey() {
                if (!currentKey) return;
                navigator.clipboard.writeText(currentKey);
                const copyBtn = document.getElementById('copyBtn');
                copyBtn.innerText = "تم النسخ! ✨";
                setTimeout(() => { copyBtn.innerText = "نسخ المفتاح 📋"; }, 2000);
            }
        </script>
    </body>
    </html>
    `);
});

// ==========================================
// 2. API توليد وحفظ المفتاح (/generate-key)
// ==========================================
app.post('/generate-key', async (req, res) => {
    try {
        if (!GITHUB_TOKEN) {
            return res.status(500).json({ success: false, message: 'GITHUB_TOKEN is missing in Render environment variables.' });
        }

        const rawKey = 'KEY-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Key-System-App',
            'Accept': 'application/vnd.github.v3+json'
        };

        // جلب الملف باستعمال fetch
        const fileRes = await fetch(getUrl, { headers });
        if (!fileRes.ok) {
            throw new Error(`GitHub GET failed: ${fileRes.statusText}`);
        }
        const fileData = await fileRes.json();

        const sha = fileData.sha;
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const keysList = JSON.parse(currentContent);

        keysList.push({
            hash: keyHash,
            createdAt: new Date().toISOString()
        });

        const updatedContentBase64 = Buffer.from(JSON.stringify(keysList, null, 2)).toString('base64');
        
        // تحديث الملف باستعمال fetch
        const putRes = await fetch(getUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Add new hashed key',
                content: updatedContentBase64,
                sha: sha
            })
        });

        if (!putRes.ok) {
            throw new Error(`GitHub PUT failed: ${putRes.statusText}`);
        }

        res.json({ success: true, key: rawKey });

    } catch (error) {
        console.error('Error in /generate-key:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error while saving key.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
