// URLマッピング設定
// microCMSのIDと任意のスラッグを対応付け
const URL_MAPPING = {
    // ID: カスタムスラッグ
    '2wm0sw5ubq': 'ai-clone-sales-automation',
    // 他の記事も追加可能
    // 'xxxxx': 'webinar-automation-guide',
    // 'yyyyy': 'email-marketing-tips',
};

// スラッグからIDを取得
const SLUG_TO_ID = Object.entries(URL_MAPPING).reduce((acc, [id, slug]) => {
    acc[slug] = id;
    return acc;
}, {});

// URLからIDまたはスラッグを取得する関数
function getArticleIdentifier() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const slug = params.get('slug');
    
    // パスから取得（/blog/slug形式）
    if (!id && !slug) {
        const path = window.location.pathname;
        const match = path.match(/\/blog\/([^\/]+)(?:\.html)?$/);
        if (match) {
            const identifier = match[1];
            // スラッグの場合はIDに変換
            return SLUG_TO_ID[identifier] || identifier;
        }
    }
    
    // スラッグパラメータがある場合はIDに変換
    if (slug && SLUG_TO_ID[slug]) {
        return SLUG_TO_ID[slug];
    }
    
    return id;
}

// IDからスラッグを取得
function getSlugFromId(id) {
    return URL_MAPPING[id] || id;
}

// SEOフレンドリーなURLを生成
function generateArticleUrl(article) {
    const slug = article.slug || URL_MAPPING[article.id] || article.id;
    return `/blog/${slug}`;
}