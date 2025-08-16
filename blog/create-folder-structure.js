const fs = require('fs');
const path = require('path');

// slugリスト
const slugs = [
    'email-marketing-benefits',
    'webinar-meeting-challenges', 
    'campfire-ai-similarity',
    'chatgpt-n8n-automation',
    'webinar-automation-guide',
    'ai-marketing-automation',
    'ai-clone-sales-automation',
    'webinar-tool-utage',
    'ai-presentation-materials'
];

// リダイレクト用HTMLテンプレート
const redirectTemplate = (slug) => `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
    <script>
        // slugをパラメータとしてarticle.htmlにリダイレクト
        window.location.href = '/blog/article.html?slug=${slug}';
    </script>
</head>
<body>
    <p>記事を読み込み中...</p>
</body>
</html>`;

// 各slugに対してフォルダとindex.htmlを生成
slugs.forEach(slug => {
    const folderPath = path.join(__dirname, slug);
    const indexPath = path.join(folderPath, 'index.html');
    
    try {
        // フォルダを作成（既存の場合はスキップ）
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        
        // index.htmlを作成
        fs.writeFileSync(indexPath, redirectTemplate(slug));
        console.log(`✅ ${slug}/index.html を作成しました`);
    } catch (error) {
        console.error(`❌ ${slug}/index.html の作成に失敗:`, error.message);
    }
});

console.log('\n✨ 拡張子なしURLに対応するフォルダ構造を作成しました！');
console.log('\n📌 アクセス例:');
console.log('- https://cenleaf.com/blog/ai-clone-sales-automation/');
console.log('- https://cenleaf.com/blog/email-marketing-benefits/');