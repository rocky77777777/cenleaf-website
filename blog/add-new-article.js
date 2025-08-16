const fs = require('fs');
const path = require('path');

// 使用方法をチェック
if (process.argv.length < 4) {
    console.log('使用方法: node add-new-article.js <slug> <記事ID>');
    console.log('例: node add-new-article.js my-new-article abc123xyz');
    process.exit(1);
}

const slug = process.argv[2];
const articleId = process.argv[3];

// article.htmlのテンプレートを読み込む
const articleTemplate = fs.readFileSync(path.join(__dirname, 'article.html'), 'utf8');

// 新しい記事用のフォルダとHTMLを作成
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
    console.log(`✅ ${slug}/index.html を作成しました`);
    console.log(`📌 URL: https://cenleaf.com/blog/${slug}/`);
    console.log('\n次のステップ:');
    console.log('1. microCMSで記事を作成');
    console.log(`2. slugフィールドに「${slug}」を設定`);
    console.log('3. git add, commit, pushで公開');
} catch (error) {
    console.error(`❌ エラー:`, error.message);
}