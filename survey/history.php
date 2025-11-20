<?php
require __DIR__ . '/config.php';
require __DIR__ . '/lib/session.php';
require __DIR__ . '/lib/db.php';
startSurveySession();

// 未ログインならログインページへ
if (empty($_SESSION['survey_authenticated'])) {
    header('Location: login.php?redirect=1');
    exit;
}

$operatorName = $_SESSION['survey_operator'] ?? '';
if ($operatorName === '') {
    header('Location: login.php?redirect=1');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>送信履歴 | 訪問看護記録</title>
    <link rel="stylesheet" href="assets/style.css">
    <style>
        body { background: #0b1220; color: #e5e7eb; }
        .history-wrapper { max-width: 1100px; margin: 0 auto; padding: 32px 16px 64px; }
        .history-card { background: #0f172a; border: 1px solid #1f2937; border-radius: 16px; padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
        .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .history-title { margin: 0; font-size: 22px; }
        .muted { color: #94a3b8; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #1f2937; padding: 10px; }
        th { background: rgba(255,255,255,0.03); }
        .btn-sm { padding: 8px 12px; border-radius: 10px; font-size: 13px; }
        .status-info { margin-top: 10px; }
    </style>
</head>
<body>
    <div class="history-wrapper">
        <div class="history-card">
            <div class="history-header">
                <div>
                    <h1 class="history-title">送信履歴</h1>
                    <div class="muted">担当者: <?php echo htmlspecialchars($operatorName, ENT_QUOTES, 'UTF-8'); ?></div>
                </div>
                <div>
                    <a href="./" class="muted">フォームへ戻る</a>
                </div>
            </div>
            <div class="muted status-info" id="statusInfo">読み込み中...</div>
            <div style="overflow-x:auto; margin-top:12px;">
                <table id="historyTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>提出日時</th>
                            <th>訪問日</th>
                            <th>訪問ID</th>
                            <th>編集</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
    <script>
        const statusInfo = document.getElementById('statusInfo');
        const tbody = document.querySelector('#historyTable tbody');

        function setStatus(msg, isError = false) {
            statusInfo.textContent = msg || '';
            statusInfo.className = isError ? 'muted status-info status error' : 'muted status-info';
        }

        async function loadHistory() {
            try {
                const res = await fetch('api/my_responses.php', { credentials: 'include' });
                const result = await res.json();
                if (!res.ok || !result.ok) {
                    throw new Error(result.message || '取得に失敗しました');
                }
                const rows = result.data || [];
                tbody.innerHTML = '';
                if (!rows.length) {
                    setStatus('まだ送信履歴がありません。');
                    return;
                }
                rows.forEach((row) => {
                    const data = row.data || {};
                    const answers = data.answers || {};
                    const visitDate = answers.visit_date || '';
                    const visitId = answers.visitor_id || '';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${row.id}</td>
                        <td>${row.submitted_at || ''}</td>
                        <td>${visitDate || ''}</td>
                        <td>${visitId || ''}</td>
                        <td><a class="btn-sm" href="edit.php?id=${row.id}">編集</a></td>
                    `;
                    tbody.appendChild(tr);
                });
                setStatus(`${rows.length}件取得しました。`);
            } catch (e) {
                setStatus(e.message, true);
            }
        }

        loadHistory();
    </script>
</body>
</html>
