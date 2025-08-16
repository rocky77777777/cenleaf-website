const fs = require('fs');
const path = require('path');

// article.htmlのテンプレートを読み込む
const articleTemplate = fs.readFileSync(path.join(__dirname, 'article.html'), 'utf8');

// 各slugと記事情報
const articles = [
    { slug: 'email-marketing-benefits', id: 'mjpe46m15jx' },
    { slug: 'webinar-meeting-challenges', id: '2wm0sw5ubq' },
    { slug: 'campfire-ai-similarity', id: 'n7mlnt5dkf' },
    { slug: 'chatgpt-n8n-automation', id: 'nuaao54oi1' },
    { slug: 'webinar-automation-guide', id: '1d8om89zb_qx' },
    { slug: 'ai-marketing-automation', id: 'x3tmsq2flo' }
];

// 各記事用の静的HTMLを生成
articles.forEach(({ slug, id }) => {
    const folderPath = path.join(__dirname, slug);
    const indexPath = path.join(folderPath, 'index.html');
    
    // article.htmlをベースに、特定のslugを直接埋め込んだバージョンを作成
    let modifiedContent = articleTemplate;
    
    // getArticleId関数を置き換えて、このページ専用のslugを返すようにする
    modifiedContent = modifiedContent.replace(
        /function getArticleId\(\) \{[\s\S]*?return null;\s*\}/,
        `function getArticleId() {
            // このページ専用のslug
            return { type: 'slug', value: '${slug}' };
        }`
    );
    
    try {
        // フォルダが存在しない場合は作成
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        
        // index.htmlを作成
        fs.writeFileSync(indexPath, modifiedContent);
        console.log(`✅ ${slug}/index.html を作成しました（リダイレクトなし）`);
    } catch (error) {
        console.error(`❌ ${slug}/index.html の作成に失敗:`, error.message);
    }
});

console.log('\n✨ リダイレクトなしの静的記事ページを作成しました！');
console.log('\n📌 使用可能なURL:');
console.log('- https://cenleaf.com/blog/webinar-meeting-challenges/');
console.log('- https://cenleaf.com/blog/email-marketing-benefits/');
console.log('- https://cenleaf.com/blog/campfire-ai-similarity/');
console.log('- https://cenleaf.com/blog/chatgpt-n8n-automation/');
console.log('- https://cenleaf.com/blog/webinar-automation-guide/');
console.log('- https://cenleaf.com/blog/ai-marketing-automation/');
console.log('\n各URLで直接記事が表示されます（リダイレクトなし）');