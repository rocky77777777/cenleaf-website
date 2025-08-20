// Google Analytics 4 追加トラッキング機能
// 注: メインのgtag.jsは各HTMLファイルに直接埋め込み済み

// このファイルは追加のトラッキング機能のみを提供
(function() {
    // gtag関数が存在することを確認
    if (typeof gtag !== 'function') {
        console.warn('Google Analytics gtag function not found. Additional tracking disabled.');
        return;
    }

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