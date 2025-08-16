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

// 各slugに対してHTMLファイルを生成
slugs.forEach(slug => {
    const filename = `${slug}.html`;
    const filepath = path.join(__dirname, filename);  // __dirnameは既にblogフォルダ内
    
    try {
        fs.writeFileSync(filepath, redirectTemplate(slug));
        console.log(`✅ ${filename} を作成しました`);
    } catch (error) {
        console.error(`❌ ${filename} の作成に失敗:`, error.message);
    }
});

console.log('\n✨ すべてのslugページを作成しました！');