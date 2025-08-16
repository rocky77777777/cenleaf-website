const https = require('https');

const API_KEY = 'gfvzXw58nnvw3daLCbWS9z22SMKeIhxa1KWw';
const SERVICE_ID = 'cenleaf';
const ENDPOINT = 'blogs';

// 記事IDとslugのマッピング
const SLUG_MAPPING = {
    '2wm0sw5ubq': 'ai-clone-sales-automation',
    'bdvjbnzs3-': 'webinar-meeting-challenges',
    'ebm9gwrhj': 'campfire-ai-similarity',
    'fq6xwmksxx4': 'email-marketing-benefits',
    '2vf4v29hm': 'webinar-tool-utage-introduction',
    'z2nzalyp7': 'presentation-materials-with-ai'
};

// タイトルからslugを生成する関数
function generateSlugFromTitle(title) {
    const slugMap = {
        'キャンプファイヤーとAIの類似性：火起こしのコツをビジネスに活かす方法': 'campfire-ai-similarity',
        'ウェビナー自動化ツール「UTAGE」の魅力を徹底解説': 'webinar-tool-utage-introduction',
        'オンラインセミナー開催の3大課題と解決策': 'webinar-meeting-challenges',
        'メルマガマーケティングの5つのメリットと始め方': 'email-marketing-benefits',
        'AIクローンが24時間365日営業する時代：個人起業家の新しい働き方': 'ai-clone-sales-automation',
        'AIで講演資料を作る方法：効率的なプレゼン準備術': 'presentation-materials-with-ai'
    };
    
    return slugMap[title] || title.toLowerCase()
        .replace(/[^\w\s-]/g, '') // 特殊文字を削除
        .replace(/\s+/g, '-') // スペースをハイフンに
        .replace(/-+/g, '-') // 連続するハイフンを1つに
        .substring(0, 50); // 長さ制限
}

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

// 記事を更新（slugを追加）
async function updateArticleWithSlug(articleId, articleData, slug) {
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
        slug: slug
    };
    
    try {
        const response = await makeRequest(options, updateData);
        console.log(`✅ ${articleData.title} にslug「${slug}」を追加しました`);
        return response;
    } catch (error) {
        console.error(`❌ ${articleData.title} の更新に失敗:`, error.message);
        return null;
    }
}

// メイン処理
async function main() {
    console.log('🚀 記事のslug更新を開始します...\n');
    
    // 既存記事を取得
    const articles = await getArticles();
    
    if (articles.length === 0) {
        console.log('記事が見つかりませんでした。');
        return;
    }
    
    console.log(`📝 ${articles.length}件の記事が見つかりました\n`);
    
    // 各記事にslugを追加
    for (const article of articles) {
        // すでにslugがある場合はスキップ
        if (article.slug) {
            console.log(`⏭️  ${article.title} には既にslug「${article.slug}」があります`);
            continue;
        }
        
        // slugを決定（マッピングがあれば使用、なければタイトルから生成）
        const slug = SLUG_MAPPING[article.id] || generateSlugFromTitle(article.title);
        
        // 記事を更新
        await updateArticleWithSlug(article.id, article, slug);
        
        // APIレート制限を考慮して待機
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✨ すべての記事の更新が完了しました！');
    console.log('\n📌 次のステップ:');
    console.log('1. microCMS管理画面でslugフィールドが追加されているか確認');
    console.log('2. ブログページのコードを更新してslugベースのURLを使用');
}

// 実行
main().catch(console.error);