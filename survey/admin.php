<?php
require __DIR__ . '/config.php';
require __DIR__ . '/lib/session.php';
require __DIR__ . '/lib/db.php';

startSurveySession();

function e(string $v): string
{
    return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}

// 管理パスワードでログイン
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['admin_password'])) {
    $input = trim((string)($_POST['admin_password'] ?? ''));
    if ($input !== '' && $input === $adminPassword) {
        $_SESSION['survey_admin_authenticated'] = true;
    } else {
        $loginError = '管理用パスワードが違います。';
    }
}

// ログアウト
if (isset($_GET['logout'])) {
    unset($_SESSION['survey_admin_authenticated']);
    header('Location: admin.php');
    exit;
}

$isAuthed = !empty($_SESSION['survey_admin_authenticated']);

?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理者一覧 | CENLEAF Survey</title>
    <link rel="stylesheet" href="assets/style.css">
    <style>
        body { background: #0b1220; }
        .admin-wrapper { max-width: 1100px; margin: 0 auto; padding: 32px 16px 64px; color: #e5e7eb; }
        .admin-card { background: #0f172a; border: 1px solid #1f2937; border-radius: 16px; padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
        .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .admin-title { margin: 0; font-size: 22px; }
        .admin-meta { color: #94a3b8; font-size: 14px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .table th, .table td { border: 1px solid #1f2937; padding: 10px; vertical-align: top; }
        .table th { background: rgba(255,255,255,0.03); white-space: nowrap; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; background: rgba(16,185,129,0.12); color: #10b981; font-weight: 600; font-size: 12px; }
        .muted { color: #94a3b8; font-size: 13px; }
        .detail-row { display: none; background: rgba(255,255,255,0.02); }
        .detail-box { padding: 12px; }
        .btn-sm { padding: 8px 12px; border-radius: 10px; font-size: 13px; }
        .login-box { max-width: 420px; margin: 0 auto; text-align: center; }
        .notice { margin-top: 12px; color: #fbbf24; font-size: 13px; }
        a { color: #38bdf8; }
    </style>
</head>
<body>
    <div class="admin-wrapper">
        <?php if (!$isAuthed): ?>
            <div class="admin-card login-box">
                <h1 class="admin-title">管理者ログイン</h1>
                <p class="muted">登録状況一覧を表示するには管理用パスワードを入力してください。</p>
                <form method="post" style="display:grid; gap:12px; margin-top:12px;">
                    <input type="password" name="admin_password" placeholder="管理用パスワード" required>
                    <button type="submit">ログイン</button>
                </form>
                <?php if (isset($loginError)): ?>
                    <div class="status error" style="margin-top:8px;"><?php echo e($loginError); ?></div>
                <?php endif; ?>
                <p class="notice">パスワードは `config.php` の `$adminPassword` または環境変数 `SURVEY_ADMIN_PASSWORD` です。</p>
            </div>
        <?php else: ?>
            <?php
            try {
                $responses = fetchResponses();
            } catch (Throwable $e) {
                $responses = [];
                $loadError = $e->getMessage();
            }
            $fields = $formDefinition['fields'] ?? [];
            ?>
            <div class="admin-card">
                <div class="admin-header">
                    <div>
                        <h1 class="admin-title">登録状況一覧</h1>
                        <div class="admin-meta">
                            <?php echo count($responses); ?> 件 / 最新順
                            <?php if (!empty($responses)): ?>
                                <span class="badge">ID <?php echo e((string)$responses[0]['id']); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="admin-actions">
                        <a href="api/export.php?password=<?php echo urlencode($adminPassword); ?>" class="badge" style="text-decoration:none;">CSV エクスポート</a>
                        <a href="admin.php?logout=1" class="muted" style="margin-left:12px;">ログアウト</a>
                    </div>
                </div>

                <?php if (isset($loadError)): ?>
                    <div class="status error">読み込みエラー: <?php echo e($loadError); ?></div>
                <?php elseif (empty($responses)): ?>
                    <p class="muted">まだ回答はありません。</p>
                <?php else: ?>
                    <div class="muted" style="margin-bottom:8px;">担当者名と訪問日・IDのみ一覧表示し、詳細ボタンで全回答を展開します。</div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>提出日時</th>
                                <th>担当者</th>
                                <th>訪問日</th>
                                <th>訪問ID</th>
                                <th>詳細</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($responses as $row): ?>
                                <?php
                                    $data = $row['data'] ?? [];
                                    $meta = $data['meta'] ?? [];
                                    $answers = $data['answers'] ?? [];
                                    $visitDate = $answers['visit_date'] ?? '';
                                    $visitId = $answers['visitor_id'] ?? '';
                                    $detailId = 'detail-' . (int) $row['id'];
                                ?>
                                <tr>
                                    <td><?php echo (int) $row['id']; ?></td>
                                    <td><?php echo e((string) $row['submitted_at']); ?></td>
                                    <td>
                                        <div><?php echo e((string) ($meta['operator'] ?? '')); ?></div>
                                        <div class="muted"><?php echo e((string) ($meta['operator_email'] ?? '')); ?></div>
                                    </td>
                                    <td><?php echo e((string) $visitDate); ?></td>
                                    <td><?php echo e((string) $visitId); ?></td>
                                    <td><button type="button" class="btn-sm" data-target="<?php echo e($detailId); ?>">詳細</button></td>
                                </tr>
                                <tr id="<?php echo e($detailId); ?>" class="detail-row">
                                    <td colspan="6">
                                        <div class="detail-box">
                                            <div class="muted" style="margin-bottom:6px;">UA: <?php echo e((string) ($meta['user_agent'] ?? '')); ?> / IP: <?php echo e((string) ($meta['ip'] ?? '')); ?></div>
                                            <?php foreach ($fields as $field): ?>
                                                <?php
                                                    $key = $field['key'];
                                                    $label = $field['label'];
                                                    $value = $answers[$key] ?? '';
                                                    if (is_array($value)) {
                                                        $value = implode(' / ', $value);
                                                    }
                                                ?>
                                                <div><strong><?php echo e((string) $label); ?>:</strong> <?php echo e((string) $value); ?></div>
                                            <?php endforeach; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </div>
    <script>
        document.querySelectorAll('button[data-target]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const row = document.getElementById(targetId);
                if (!row) return;
                row.style.display = row.style.display === 'table-row' ? 'none' : 'table-row';
            });
        });
    </script>
</body>
</html>
