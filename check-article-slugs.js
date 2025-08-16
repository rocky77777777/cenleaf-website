const https = require('https');

const API_KEY = 'gfvzXw58nnvw3daLCbWS9z22SMKeIhxa1KWw';
const SERVICE_ID = 'cenleaf';
const ENDPOINT = 'blogs';

// HTTPリクエストを送信する関数
function makeRequest(url, headers) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        }).on('error', reject);
    });
}

async function checkSlugs() {
    const headers = {
        'X-MICROCMS-API-KEY': API_KEY
    };
    
    console.log('📝 記事のslugフィールドを確認中...\n');
    
    // 全記事を取得
    const url = `https://${SERVICE_ID}.microcms.io/api/v1/${ENDPOINT}?limit=100`;
    const result = await makeRequest(url, headers);
    
    if (result.data.contents) {
        console.log(`全${result.data.totalCount}件の記事:\n`);
        
        result.data.contents.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   - ID: ${article.id}`);
            console.log(`   - slug: ${article.slug || '❌ 未設定'}`);
            console.log(`   - カテゴリー: ${article.category ? article.category.name : '未分類'}`);
            console.log('');
        });
        
        // slugが設定されていない記事をカウント
        const noSlug = result.data.contents.filter(a => !a.slug);
        if (noSlug.length > 0) {
            console.log(`⚠️  ${noSlug.length}件の記事にslugが設定されていません`);
        } else {
            console.log('✅ すべての記事にslugが設定されています');
        }
    }
}

checkSlugs().catch(console.error);