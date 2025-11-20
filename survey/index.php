<?php
require __DIR__ . '/config.php';
require __DIR__ . '/lib/session.php';
startSurveySession();

// キャッシュさせない（リダイレクト判定を確実にする）
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// 未ログインならログインページへリダイレクト
if (empty($_SESSION['survey_authenticated'])) {
    header('Location: login.php?redirect=1');
    exit;
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo e($formDefinition['title']); ?> | CENLEAF Survey</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="wrapper">
        <div class="card">
            <h1 class="title"><?php echo e($formDefinition['title']); ?></h1>
            <?php if (!empty($formDefinition['description'])): ?>
                <p class="description"><?php echo nl2br(e($formDefinition['description'])); ?></p>
            <?php endif; ?>

            <div class="login-card" id="loginCard">
                <div class="login-title">新規登録前ログイン</div>
                <div class="login-fields">
                    <label for="operatorName">担当者名</label>
                    <input id="operatorName" type="text" placeholder="例: 鈴木 / 山田" />
                </div>
                <div class="login-fields">
                    <label for="operatorEmail">メールアドレス</label>
                    <input id="operatorEmail" type="email" placeholder="example@example.com" />
                </div>
                <div class="login-fields">
                    <label for="operatorPassword">パスワード</label>
                    <input id="operatorPassword" type="password" placeholder="パスワードを入力" />
                </div>
                <div class="login-actions">
                    <button type="button" id="loginButton">ログインして開始</button>
                    <span class="operator-status" id="operatorStatus"></span>
                </div>
            </div>

            <form id="surveyForm" novalidate>
                <?php foreach ($formDefinition['fields'] as $field): ?>
                    <?php
                        $key = e($field['key']);
                        $label = e($field['label']);
                        $required = !empty($field['required']);
                        $placeholder = isset($field['placeholder']) ? e($field['placeholder']) : '';
                        $type = $field['type'] ?? 'text';
                    ?>
                    <div class="field">
                        <label for="<?php echo $key; ?>">
                            <?php echo $label; ?>
                            <?php if ($required): ?>
                                <small>(必須)</small>
                            <?php endif; ?>
                        </label>
                        <?php if ($type === 'textarea'): ?>
                            <textarea
                                id="<?php echo $key; ?>"
                                name="<?php echo $key; ?>"
                                <?php echo $required ? 'required' : ''; ?>
                                placeholder="<?php echo $placeholder; ?>"
                            ></textarea>
                        <?php elseif ($type === 'checkboxes' && !empty($field['options']) && is_array($field['options'])): ?>
                            <div class="checkbox-group">
                                <?php foreach ($field['options'] as $option): ?>
                                    <?php $optionSafe = e($option); ?>
                                    <label class="checkbox-item">
                                        <input
                                            type="checkbox"
                                            name="<?php echo $key; ?>"
                                            value="<?php echo $optionSafe; ?>"
                                        />
                                        <span><?php echo $optionSafe; ?></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        <?php elseif ($type === 'select' && !empty($field['options']) && is_array($field['options'])): ?>
                            <select id="<?php echo $key; ?>" name="<?php echo $key; ?>" <?php echo $required ? 'required' : ''; ?>>
                                <option value="">選択してください</option>
                                <?php foreach ($field['options'] as $option): ?>
                                    <option value="<?php echo e($option); ?>"><?php echo e($option); ?></option>
                                <?php endforeach; ?>
                            </select>
                        <?php else: ?>
                            <input
                                id="<?php echo $key; ?>"
                                name="<?php echo $key; ?>"
                                type="<?php echo e($type); ?>"
                                <?php echo $required ? 'required' : ''; ?>
                                placeholder="<?php echo $placeholder; ?>"
                            />
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>

                <div class="actions">
                    <button type="submit" id="submitButton">送信する</button>
                    <div class="status" id="status"></div>
                </div>
                <p class="helper">送信内容はサーバー上のローカルデータベースに保存されます。</p>
            </form>
        </div>
    </div>

    <script>
        const defaultMessage = <?php echo json_encode($formDefinition['thank_you_message'] ?? '送信ありがとうございました。'); ?>;

        const form = document.getElementById('surveyForm');
        const statusEl = document.getElementById('status');
        const submitBtn = document.getElementById('submitButton');
        const operatorStatus = document.getElementById('operatorStatus');
        const operatorNameInput = document.getElementById('operatorName');
        const operatorEmailInput = document.getElementById('operatorEmail');
        const operatorPasswordInput = document.getElementById('operatorPassword');
        const loginButton = document.getElementById('loginButton');
        const loginCard = document.getElementById('loginCard');

        function setStatus(message, type = '') {
            statusEl.textContent = message || '';
            statusEl.className = `status ${type}`;
        }

        // ログイン処理
        const OPERATOR_KEY = 'survey_operator_name';
        const OPERATOR_EMAIL_KEY = 'survey_operator_email';
        const PASSWORD_KEY = 'survey_session_password';

        function updateLoginState(loggedIn, name = '') {
            if (loggedIn) {
                loginCard.style.display = 'none';
                form.style.opacity = 1;
                form.style.pointerEvents = 'auto';
                operatorStatus.textContent = `ログイン中: ${name}`;
                operatorStatus.className = 'operator-status';
            } else {
                loginCard.style.display = 'block';
                form.style.opacity = 0.4;
                form.style.pointerEvents = 'none';
                operatorStatus.textContent = 'ログインしてください';
                operatorStatus.className = 'operator-status error';
            }
        }

        async function loginWithSaved(name, email, password) {
            try {
                const res = await fetch('api/login.php', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operator_name: name, operator_email: email, operator_password: password })
                });
                const result = await res.json();
                if (res.ok && result.ok) {
                    updateLoginState(true, `${name} (${email})`);
                } else {
                    updateLoginState(false);
                }
            } catch (e) {
                updateLoginState(false);
            }
        }

        async function login() {
            const name = operatorNameInput.value.trim();
            const email = operatorEmailInput.value.trim();
            const password = operatorPasswordInput.value.trim();
            if (!name || !email || !password) {
                operatorStatus.textContent = '担当者名・メールアドレス・パスワードを入力してください';
                operatorStatus.className = 'operator-status error';
                return;
            }
            operatorStatus.textContent = '確認中...';
            operatorStatus.className = 'operator-status';

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
                sessionStorage.setItem(PASSWORD_KEY, password);
                localStorage.setItem(OPERATOR_KEY, name);
                localStorage.setItem(OPERATOR_EMAIL_KEY, email);
                updateLoginState(true, `${name} (${email})`);
            } catch (error) {
                operatorStatus.textContent = error.message;
                operatorStatus.className = 'operator-status error';
            }
        }

        function initLogin() {
            const savedName = localStorage.getItem(OPERATOR_KEY) || '';
            const savedEmail = localStorage.getItem(OPERATOR_EMAIL_KEY) || '';
            if (savedName) {
                operatorNameInput.value = savedName;
            }
            if (savedEmail) {
                operatorEmailInput.value = savedEmail;
            }
            const savedPassword = sessionStorage.getItem(PASSWORD_KEY) || '';
            if (savedName && savedEmail && savedPassword) {
                // サーバー側セッションを再取得するため、サイレントにログインを試行
                loginWithSaved(savedName, savedEmail, savedPassword);
            } else {
                updateLoginState(false);
            }
        }

        loginButton.addEventListener('click', login);
        initLogin();

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setStatus('', '');

            const operator = operatorNameInput.value.trim();
            if (!operator) {
                setStatus('担当者名を入力してください。', 'error');
                operatorStatus.textContent = '担当者名を入力してください';
                operatorStatus.className = 'operator-status error';
                return;
            }

            submitBtn.disabled = true;
            setStatus('送信中...', '');

            const formData = new FormData(form);
            const payload = {};

            for (const [key, value] of formData.entries()) {
                if (Object.prototype.hasOwnProperty.call(payload, key)) {
                    if (Array.isArray(payload[key])) {
                        payload[key].push(value);
                    } else {
                        payload[key] = [payload[key], value];
                    }
                } else {
                    payload[key] = value;
                }
            }

            payload.operator_name = operator;

            try {
                const response = await fetch('api/submit.php', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (!response.ok || !result.ok) {
                    throw new Error(result.message || '送信に失敗しました。');
                }

                setStatus(result.message || defaultMessage, 'success');
                form.reset();
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
    </script>
</body>
</html>
