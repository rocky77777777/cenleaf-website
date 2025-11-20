<?php
require __DIR__ . '/config.php';
require __DIR__ . '/lib/session.php';
startSurveySession();

// キャッシュさせない
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// 既にログイン済みならフォームへ
if (!empty($_SESSION['survey_authenticated'])) {
    header('Location: ./');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新規登録 | 訪問看護記録</title>
    <link rel="stylesheet" href="assets/style.css">
    <style>
        .register-wrapper {
            max-width: 600px;
            margin: 0 auto;
            padding: 32px 16px 64px;
        }
        .register-card {
            background: linear-gradient(145deg, rgba(17, 24, 39, 0.9), rgba(7, 11, 21, 0.9));
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.03);
        }
        .register-title {
            font-size: 24px;
            margin: 0 0 12px;
        }
        .register-desc {
            color: var(--muted);
            margin-bottom: 18px;
            line-height: 1.6;
        }
        .register-fields {
            display: grid;
            gap: 10px;
            margin-bottom: 16px;
        }
        .register-fields label {
            font-weight: 600;
        }
        .register-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .register-status {
            color: var(--muted);
            font-size: 13px;
        }
        .register-status.error { color: var(--danger); }
        .tips {
            margin-top: 18px;
            color: var(--muted);
            font-size: 13px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="register-wrapper">
        <div class="register-card">
            <h1 class="register-title">新規登録</h1>
            <p class="register-desc">
                初めて利用する場合は、担当者名・メールアドレス・パスワードを登録してください。完了後、自動的に記録フォーム（<code>/survey/</code>）へ移動します。
            </p>

            <div class="register-fields">
                <label for="regName">担当者名</label>
                <input id="regName" type="text" placeholder="例: 鈴木 / 山田" />
            </div>
            <div class="register-fields">
                <label for="regEmail">メールアドレス</label>
                <input id="regEmail" type="email" placeholder="example@example.com" />
            </div>
            <div class="register-fields">
                <label for="regPassword">パスワード</label>
                <input id="regPassword" type="password" placeholder="パスワードを入力" />
            </div>
            <div class="register-actions">
                <button type="button" id="registerBtn">ログインしてフォームへ進む</button>
                <span class="register-status" id="registerStatus"></span>
            </div>
            <div class="tips">
                - パスワードはセッション中のみ保存します。<br>
                - 担当者名は次回入力を省略するためにブラウザに保存します。
                <br>- 既に登録済みの方は <a href="login.php">こちらからログイン</a>
            </div>
        </div>
    </div>

    <script>
        const OPERATOR_KEY = 'survey_operator_name';
        const OPERATOR_EMAIL_KEY = 'survey_operator_email';
        const PASSWORD_KEY = 'survey_session_password';

        const regName = document.getElementById('regName');
        const regEmail = document.getElementById('regEmail');
        const regPassword = document.getElementById('regPassword');
        const registerBtn = document.getElementById('registerBtn');
        const registerStatus = document.getElementById('registerStatus');

        function loadSaved() {
            const saved = localStorage.getItem(OPERATOR_KEY) || '';
            if (saved) regName.value = saved;
            const savedEmail = localStorage.getItem(OPERATOR_EMAIL_KEY) || '';
            if (savedEmail) regEmail.value = savedEmail;
        }

        async function doRegister() {
            const name = regName.value.trim();
            const email = regEmail.value.trim();
            const password = regPassword.value.trim();
            if (!name || !email || !password) {
                registerStatus.textContent = '担当者名・メールアドレス・パスワードを入力してください';
                registerStatus.className = 'register-status error';
                return;
            }
            registerStatus.textContent = '確認中...';
            registerStatus.className = 'register-status';

            try {
                const res = await fetch('api/login.php', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operator_name: name, operator_email: email, operator_password: password })
                });
                const result = await res.json();
                if (!res.ok || !result.ok) {
                    throw new Error(result.message || 'ログインに失敗しました');
                }
                localStorage.setItem(OPERATOR_KEY, name);
                localStorage.setItem(OPERATOR_EMAIL_KEY, email);
                sessionStorage.setItem(PASSWORD_KEY, password);
                registerStatus.textContent = '認証成功。フォームへ移動します...';
                setTimeout(() => {
                    window.location.href = './';
                }, 500);
            } catch (error) {
                registerStatus.textContent = error.message;
                registerStatus.className = 'register-status error';
            }
        }

        registerBtn.addEventListener('click', doRegister);
        loadSaved();
    </script>
</body>
</html>
