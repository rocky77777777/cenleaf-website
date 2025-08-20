// Google Analytics 4 トラッキングコード
// CENLEAF用測定ID
const GA_MEASUREMENT_ID = 'G-B2PX7E1PP5'; // cenleaf.com用GA4測定ID

// Google Analytics gtag.js の読み込み
(function() {
    // gtag.jsスクリプトの動的読み込み
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // gtag設定
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
        page_path: window.location.pathname,
        page_title: document.title
    });

    // カスタムイベントの送信例
    window.trackEvent = function(eventName, parameters) {
        gtag('event', eventName, parameters);
    };

    // ページビューの手動送信（SPAの場合に使用）
    window.trackPageView = function(pagePath, pageTitle) {
        gtag('config', GA_MEASUREMENT_ID, {
            page_path: pagePath || window.location.pathname,
            page_title: pageTitle || document.title
        });
    };

    // スクロール深度の測定
    let scrollDepthTracked = {25: false, 50: false, 75: false, 100: false};
    window.addEventListener('scroll', function() {
        const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.body.offsetHeight * 100);
        
        [25, 50, 75, 100].forEach(depth => {
            if (scrollPercent >= depth && !scrollDepthTracked[depth]) {
                scrollDepthTracked[depth] = true;
                gtag('event', 'scroll', {
                    event_category: 'engagement',
                    event_label: `${depth}%`,
                    value: depth
                });
            }
        });
    });

    // リンククリックの追跡
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href) {
            const url = new URL(target.href);
            
            // 外部リンクの追跡
            if (url.hostname !== window.location.hostname) {
                gtag('event', 'click', {
                    event_category: 'outbound',
                    event_label: url.href,
                    transport_type: 'beacon'
                });
            }
            
            // お問い合わせボタンなど重要なクリックの追跡
            if (target.classList.contains('cta-button') || target.classList.contains('contact-button')) {
                gtag('event', 'generate_lead', {
                    event_category: 'engagement',
                    event_label: target.textContent || 'CTA Click'
                });
            }
        }
    });

    // フォーム送信の追跡
    document.addEventListener('submit', function(e) {
        if (e.target.tagName === 'FORM') {
            const formName = e.target.name || e.target.id || 'unnamed_form';
            gtag('event', 'form_submit', {
                event_category: 'engagement',
                event_label: formName
            });
        }
    });

    console.log('Google Analytics 4 initialized with ID:', GA_MEASUREMENT_ID);
})();