// Google Analytics 4 人気記事取得機能
// 注意: この実装にはGoogle Analytics Data APIの設定が必要です

class PopularArticlesManager {
    constructor() {
        // GA4の設定
        this.propertyId = '455799120'; // あなたのGA4プロパティID
        this.popularArticles = [];
    }

    // 方法1: Google Analytics Reporting APIを使用（要認証設定）
    async fetchPopularArticlesFromGA() {
        // この実装にはGoogle Cloud Consoleでの設定が必要：
        // 1. Google Analytics Data APIを有効化
        // 2. サービスアカウントキーを作成
        // 3. GA4プロパティにサービスアカウントを追加
        
        try {
            const response = await fetch('/api/analytics/popular', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.popularArticles = data.articles;
                return this.popularArticles;
            }
        } catch (error) {
            console.error('GA4 APIエラー:', error);
            return [];
        }
    }

    // 方法2: ローカルストレージでビュー数をカウント（簡易版）
    trackPageView(articleId, articleTitle) {
        const viewsKey = 'article_views';
        let views = JSON.parse(localStorage.getItem(viewsKey) || '{}');
        
        if (!views[articleId]) {
            views[articleId] = {
                id: articleId,
                title: articleTitle,
                count: 0,
                lastViewed: null
            };
        }
        
        views[articleId].count++;
        views[articleId].lastViewed = new Date().toISOString();
        
        localStorage.setItem(viewsKey, JSON.stringify(views));
        
        // Google Analyticsにもイベント送信
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_title: articleTitle,
                page_location: window.location.href,
                article_id: articleId
            });
        }
    }

    // ローカルストレージから人気記事を取得
    getPopularArticlesFromLocal() {
        const viewsKey = 'article_views';
        const views = JSON.parse(localStorage.getItem(viewsKey) || '{}');
        
        // オブジェクトを配列に変換してソート
        const sortedArticles = Object.values(views)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // トップ10を取得
        
        return sortedArticles;
    }

    // 人気記事ウィジェットを表示
    displayPopularWidget(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const popularArticles = this.getPopularArticlesFromLocal();
        
        if (popularArticles.length === 0) {
            container.innerHTML = '<p>まだ人気記事データがありません</p>';
            return;
        }

        const html = `
            <div class="popular-articles-widget">
                <h3>🔥 人気記事ランキング</h3>
                <ol class="popular-list">
                    ${popularArticles.map((article, index) => `
                        <li class="popular-item">
                            <span class="rank">${index + 1}</span>
                            <a href="/blog/article.html?id=${article.id}">
                                ${article.title}
                            </a>
                            <span class="view-count">${article.count} views</span>
                        </li>
                    `).join('')}
                </ol>
            </div>
        `;
        
        container.innerHTML = html;
    }

    // 記事一覧を人気順にソート
    sortArticlesByPopularity(articles) {
        const views = JSON.parse(localStorage.getItem('article_views') || '{}');
        
        return articles.sort((a, b) => {
            const viewsA = views[a.id] ? views[a.id].count : 0;
            const viewsB = views[b.id] ? views[b.id].count : 0;
            return viewsB - viewsA;
        });
    }
}

// 使用例：blog/index.htmlに追加
/*
<script src="popular-articles.js"></script>
<script>
    const popularManager = new PopularArticlesManager();
    
    // 記事一覧ページで人気順に並び替え
    document.getElementById('sort-popular').addEventListener('click', () => {
        const sortedArticles = popularManager.sortArticlesByPopularity(allPosts);
        displayPosts(sortedArticles);
    });
    
    // 記事詳細ページでビューをトラック
    if (articleId && articleTitle) {
        popularManager.trackPageView(articleId, articleTitle);
    }
    
    // サイドバーに人気記事ウィジェットを表示
    popularManager.displayPopularWidget('popular-widget');
</script>
*/

// スタイル例
const popularStyles = `
<style>
.popular-articles-widget {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 15px;
    margin: 20px 0;
}

.popular-articles-widget h3 {
    margin-bottom: 15px;
    font-size: 1.2em;
}

.popular-list {
    list-style: none;
    padding: 0;
}

.popular-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    transition: background 0.3s;
}

.popular-item:hover {
    background: rgba(255, 255, 255, 0.2);
}

.rank {
    display: inline-block;
    width: 30px;
    height: 30px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    text-align: center;
    line-height: 30px;
    margin-right: 12px;
    font-weight: bold;
}

.popular-item a {
    flex: 1;
    color: white;
    text-decoration: none;
}

.view-count {
    font-size: 0.85em;
    opacity: 0.8;
    margin-left: 10px;
}

/* ソートボタン */
.sort-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.sort-button {
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: transform 0.2s;
}

.sort-button:hover {
    transform: translateY(-2px);
}

.sort-button.active {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
</style>
`;

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopularArticlesManager;
}