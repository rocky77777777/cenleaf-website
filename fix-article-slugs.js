const https = require('https');

const API_KEY = 'gfvzXw58nnvw3daLCbWS9z22SMKeIhxa1KWw';
const SERVICE_ID = 'cenleaf';
const ENDPOINT = 'blogs';

// 適切なslugのマッピング（タイトルベース）
const TITLE_TO_SLUG = {
    '「メルマガって古くない？」と思ったあなたが知らない10の真実': 'email-marketing-benefits',
    'セミナー開催が「面倒くさい」と思っているあなたへ：5つのハードルと即効解決法': 'webinar-meeting-challenges',
    '「AIは難しそう」という人にキャンプの火起こしで例えてみた話': 'campfire-ai-similarity',
    'ChatGPT×n8nで作る最強の業務自動化システム【実践編】': 'chatgpt-n8n-automation',
    'ウェビナー自動化で月商300万円を達成した3つのステップ': 'webinar-automation-guide',
    'AIとマーケティングの自動化で、時間と場所の自由を手に入れた話': 'ai-marketing-automation',
    'AIクローンが24時間365日営業する時代：個人起業家の新しい働き方': 'ai-clone-sales-automation',
    'ウェビナー自動化ツール「UTAGE」の魅力を徹底解説': 'webinar-tool-utage',
    'AIで講演資料を作る方法：効率的なプレゼン準備術': 'ai-presentation-materials'
};

// HTTPリクエストを送信する関数
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${responseData}`));
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// 既存記事を取得
async function getArticles() {
    const options = {
        hostname: `${SERVICE_ID}.microcms.io`,
        path: `/api/v1/${ENDPOINT}?limit=100`,
        method: 'GET',
        headers: {
            'X-MICROCMS-API-KEY': API_KEY
        }
    };
    
    try {
        const response = await makeRequest(options);
        return response.contents;
    } catch (error) {
        console.error('記事取得エラー:', error);
        return [];
    }
}

// 記事を更新（slugを修正）
async function updateArticleSlug(articleId, title, newSlug) {
    const options = {
        hostname: `${SERVICE_ID}.microcms.io`,
        path: `/api/v1/${ENDPOINT}/${articleId}`,
        method: 'PATCH',
        headers: {
            'X-MICROCMS-API-KEY': API_KEY,
            'Content-Type': 'application/json'
        }
    };
    
    const updateData = {
        slug: newSlug
    };
    
    try {
        const response = await makeRequest(options, updateData);
        console.log(`✅ 「${title}」のslugを「${newSlug}」に更新しました`);
        return response;
    } catch (error) {
        console.error(`❌ 「${title}」の更新に失敗:`, error.message);
        return null;
    }
}

// メイン処理
async function main() {
    console.log('🚀 記事のslug修正を開始します...\n');
    
    // 既存記事を取得
    const articles = await getArticles();
    
    if (articles.length === 0) {
        console.log('記事が見つかりませんでした。');
        return;
    }
    
    console.log(`📝 ${articles.length}件の記事が見つかりました\n`);
    console.log('現在の記事とslug:');
    articles.forEach(article => {
        console.log(`- 「${article.title}」: ${article.slug || '(未設定)'}`);
    });
    console.log('\n');
    
    // 各記事のslugを修正
    for (const article of articles) {
        const properSlug = TITLE_TO_SLUG[article.title];
        
        if (!properSlug) {
            console.log(`⚠️  「${article.title}」のslugマッピングが見つかりません`);
            continue;
        }
        
        if (article.slug === properSlug) {
            console.log(`⏭️  「${article.title}」は既に正しいslug「${properSlug}」です`);
            continue;
        }
        
        // slugを更新
        await updateArticleSlug(article.id, article.title, properSlug);
        
        // APIレート制限を考慮して待機
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✨ すべての記事のslug修正が完了しました！');
    console.log('\n📌 記事URLの例:');
    console.log('- https://cenleaf.com/blog/ai-clone-sales-automation');
    console.log('- https://cenleaf.com/blog/webinar-automation-guide');
    console.log('- https://cenleaf.com/blog/email-marketing-benefits');
}

// 実行
main().catch(console.error);