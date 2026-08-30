const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// المتغيرات البيئية الخاصة بـ GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // صيغة: username/repository-name
const FILE_PATH = 'keys.json';

app.use(express.json());

// تشغيل مجلد public في حال وجود واجهة HTML
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 0. مسار الصفحة الرئيسية (لتجنب Cannot GET /)
// ==========================================
app.get('/', (req, res) => {
    // إذا كان ملف index.html موجوداً داخل مجلد public سيتم عرضه تلقائياً،
    // أما إذا لم يكن موجوداً، سيظهر هذا النص للتأكيد على أن السيرفر يعمل.
    res.send('Key System Server is running successfully!');
});

// ==========================================
// 1. مسار توليد المفاتيح (Web API)
// ==========================================
app.get('/generate-key', async (req, res) => {
    try {
        // توليد مفتاح عشوائي عالي الأمان
        const rawKey = 'KEY-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Key-System-App',
            'Accept': 'application/vnd.github.v3+json'
        };

        // جلب الملف الحالي من GitHub
        const fileRes = await fetch(getUrl, { headers });
        if (!fileRes.ok) throw new Error('Failed to fetch keys file from GitHub');

        const fileData = await fileRes.json();
        const sha = fileData.sha;
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let keysList = JSON.parse(currentContent);

        // إضافة المفتاح الجديد إلى القائمة بدون HWID في البداية
        keysList.push({
            hash: keyHash,
            hwid: null,
            createdAt: new Date().toISOString()
        });

        // رفع القائمة المحدثة إلى GitHub
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

        // البحث عن المفتاح المطابق عبر الهاش
        const keyIndex = keysList.findIndex(k => k.hash.toLowerCase() === keyHash.toLowerCase());

        if (keyIndex === -1) {
            return res.json({ success: false, message: 'Invalid Key!' });
        }

        const targetKey = keysList[keyIndex];

        // 1. إذا كان المفتاح جديد ولم يُسجل عليه HWID بعد
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

        // 2. إذا كان المفتاح مستخدم سابقاً والجهاز هو نفسه
        } else if (targetKey.hwid === hwid) {
            return res.json({ success: true, message: 'Key verified successfully!' });

        // 3. إذا كان المفتاح مقفولاً على جهاز آخر
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
