const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// المتغيرات البيئية الخاصّة بـ GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // صيغة: username/repository-name
const FILE_PATH = 'keys.json';

app.use(express.json());

// ==========================================
// 0. واجهة الموقع الرئيسية (HTML/CSS/JS)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>نظام الحصول على المفتاح | Key System</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: 'Tajawal', sans-serif;
            }
            body {
                background: #0f172a;
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
            }
            .container {
                background: #1e293b;
                padding: 30px;
                border-radius: 16px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                width: 100%;
                max-width: 450px;
                text-align: center;
                border: 1px solid #334155;
            }
            h1 {
                font-size: 24px;
                margin-bottom: 10px;
                color: #38bdf8;
            }
            p {
                color: #94a3b8;
                font-size: 14px;
                margin-bottom: 25px;
            }
            .btn {
                background: #0284c7;
                color: white;
                border: none;
                padding: 12px 24px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 8px;
                cursor: pointer;
                transition: 0.3s;
                width: 100%;
            }
            .btn:hover {
                background: #0369a1;
            }
            .btn:disabled {
                background: #475569;
                cursor: not-allowed;
            }
            .key-box {
                margin-top: 20px;
                display: none;
            }
            input[type="text"] {
                width: 100%;
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #475569;
                background: #0f172a;
                color: #38bdf8;
                font-size: 16px;
                text-align: center;
                font-weight: bold;
                margin-bottom: 10px;
                outline: none;
            }
            .copy-btn {
                background: #22c55e;
            }
            .copy-btn:hover {
                background: #16a34a;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>نظام المفاتيح الخاص بالسكربت</h1>
            <p>اضغط على الزر أدناه لتوليد مفتاح التفعيل الخاص بك لاستخدامه داخل اللعبة</p>
            
            <button id="genBtn" class="btn" onclick="generateKey()">توليد مفتاح جديد 🔑</button>

            <div id="keyBox" class="key-box">
                <input type="text" id="keyInput" readonly>
                <button class="btn copy-btn" onclick="copyKey()">نسخ المفتاح 📋</button>
            </div>
        </div>

        <script>
            async function generateKey() {
                const btn = document.getElementById('genBtn');
                const keyBox = document.getElementById('keyBox');
                const keyInput = document.getElementById('keyInput');

                btn.disabled = true;
                btn.innerText = 'جاري التوليد... ⏳';

                try {
                    const response = await fetch('/generate-key');
                    const data = await response.json();

                    if (data.success) {
                        keyInput.value = data.key;
                        keyBox.style.display = 'block';
                        btn.style.display = 'none';
                    } else {
                        alert('حدث خطأ: ' + data.message);
                        btn.disabled = false;
                        btn.innerText = 'توليد مفتاح جديد 🔑';
                    }
                } catch (err) {
                    alert('فشل الاتصال بالسيرفر!');
                    btn.disabled = false;
                    btn.innerText = 'توليد مفتاح جديد 🔑';
                }
            }

            function copyKey() {
                const keyInput = document.getElementById('keyInput');
                keyInput.select();
                document.execCommand('copy');
                alert('تم نسخ المفتاح بنجاح!');
            }
        </script>
    </body>
    </html>
    `);
});

// ==========================================
// 1. مسار توليد المفاتيح (Web API)
// ==========================================
app.get('/generate-key', async (req, res) => {
    try {
        const rawKey = 'KEY-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Key-System-App',
            'Accept': 'application/vnd.github.v3+json'
        };

        const fileRes = await fetch(getUrl, { headers });
        if (!fileRes.ok) throw new Error('Failed to fetch keys file from GitHub');

        const fileData = await fileRes.json();
        const sha = fileData.sha;
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let keysList = JSON.parse(currentContent);

        keysList.push({
            hash: keyHash,
            hwid: null,
            createdAt: new Date().toISOString()
        });

        const updatedContentBase64 = Buffer.from(JSON.stringify(keysList, null, 2)).toString('base64');
        const updateRes = await fetch(getUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Add new generated key',
                content: updatedContentBase64,
                sha: sha
            })
        });

        if (!updateRes.ok) throw new Error('Failed to update keys file on GitHub');

        res.json({ success: true, key: rawKey });

    } catch (error) {
        console.error('Error generating key:', error.message);
        res.status(500).json({ success: false, message: 'Server error generating key' });
    }
});

// ==========================================
// 2. مسار التحقق من المفتاح والـ HWID (Roblox API)
// ==========================================
app.post('/verify-key', async (req, res) => {
    try {
        const { key, hwid } = req.body;

        if (!key || !hwid) {
            return res.status(400).json({ success: false, message: 'Key and HWID are required!' });
        }

        const keyHash = crypto.createHash('sha256').update(key.trim()).digest('hex');
        const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Key-System-App',
            'Accept': 'application/vnd.github.v3+json'
        };

        const fileRes = await fetch(getUrl, { headers });
        if (!fileRes.ok) throw new Error('Failed to fetch keys from GitHub');
        
        const fileData = await fileRes.json();
        const sha = fileData.sha;
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let keysList = JSON.parse(currentContent);

        const keyIndex = keysList.findIndex(k => k.hash.toLowerCase() === keyHash.toLowerCase());

        if (keyIndex === -1) {
            return res.json({ success: false, message: 'Invalid Key!' });
        }

        const targetKey = keysList[keyIndex];

        // 1. مفتاح جديد لم يُقفل بعد
        if (!targetKey.hwid) {
            targetKey.hwid = hwid;
            keysList[keyIndex] = targetKey;

            const updatedContentBase64 = Buffer.from(JSON.stringify(keysList, null, 2)).toString('base64');
            await fetch(getUrl, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Bind HWID to key',
                    content: updatedContentBase64,
                    sha: sha
                })
            });

            return res.json({ success: true, message: 'Key verified and locked to your device!' });

        // 2. مفتاح سابق لنفس الجهاز
        } else if (targetKey.hwid === hwid) {
            return res.json({ success: true, message: 'Key verified successfully!' });

        // 3. مفتاح مقفول لجهاز آخر
        } else {
            return res.json({ success: false, message: 'This key is bound to another device!' });
        }

    } catch (error) {
        console.error('Error verifying key:', error.message);
        res.status(500).json({ success: false, message: 'Server Error during verification' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
           
