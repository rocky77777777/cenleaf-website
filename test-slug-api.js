const https = require('https');

const API_KEY = 'gfvzXw58nnvw3daLCbWS9z22SMKeIhxa1KWw';
const SERVICE_ID = 'cenleaf';
const ENDPOINT = 'blogs';

// テストするslug
const testSlug = 'ai-clone-sales-automation';

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

async function testSlugQuery() {
    const headers = {
        'X-MICROCMS-API-KEY': API_KEY
    };
    
    console.log('🔍 slug検索のテスト...\n');
    
    // 方法1: filters=slug[equals]value
    const url1 = `https://${SERVICE_ID}.microcms.io/api/v1/${ENDPOINT}?filters=slug[equals]${testSlug}`;
    console.log('URL1:', url1);
    const result1 = await makeRequest(url1, headers);
    console.log('結果1:', result1.status, result1.data.totalCount ? `${result1.data.totalCount}件` : 'エラー');
    
    // 方法2: filters=slug[equals]value（URLエンコード）
    const url2 = `https://${SERVICE_ID}.microcms.io/api/v1/${ENDPOINT}?filters=${encodeURIComponent(`slug[equals]${testSlug}`)}`;
    console.log('\nURL2:', url2);
    const result2 = await makeRequest(url2, headers);
    console.log('結果2:', result2.status, result2.data.totalCount ? `${result2.data.totalCount}件` : 'エラー');
    
    // 方法3: 全記事を取得してslugでフィルタ
    const url3 = `https://${SERVICE_ID}.microcms.io/api/v1/${ENDPOINT}?limit=100`;
    console.log('\nURL3（全記事取得）:', url3);
    const result3 = await makeRequest(url3, headers);
    
    if (result3.data.contents) {
        const filtered = result3.data.contents.filter(item => item.slug === testSlug);
        console.log('結果3:', result3.status, `全${result3.data.totalCount}件中、slug="${testSlug}"は${filtered.length}件`);
        
        if (filtered.length > 0) {
            console.log('\n✅ 記事が見つかりました:');
            console.log('- ID:', filtered[0].id);
            console.log('- タイトル:', filtered[0].title);
            console.log('- slug:', filtered[0].slug);
        }
    }
}

testSlugQuery().catch(console.error);