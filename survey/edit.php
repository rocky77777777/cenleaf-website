<?php
require __DIR__ . '/config.php';
require __DIR__ . '/lib/session.php';
require __DIR__ . '/lib/db.php';
startSurveySession();

if (empty($_SESSION['survey_authenticated'])) {
    header('Location: login.php?redirect=1');
    exit;
}

$operatorName = $_SESSION['survey_operator'] ?? '';
$operatorEmail = $_SESSION['survey_operator_email'] ?? '';
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id <= 0) {
    http_response_code(400);
    echo 'ID パラメータが不正です。';
    exit;
}

$row = fetchResponseById($id);
if (!$row) {
    http_response_code(404);
    echo '該当データが見つかりません。';
    exit;
}

$owner = $row['data']['meta']['operator'] ?? '';
if ($owner !== $operatorName) {
    http_response_code(403);
    echo 'このデータを編集する権限がありません。';
    exit;
}

$answers = $row['data']['answers'] ?? [];

function e(string $v): string { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>回答の編集 | 訪問看護記録</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="wrapper">
        <div class="card">
            <h1 class="title">回答の編集 (ID: <?php echo (int)$row['id']; ?>)</h1>
            <p class="description">担当者: <?php echo e($operatorName); ?>（<?php echo e($operatorEmail); ?>） / 提出日時: <?php echo e((string)$row['submitted_at']); ?></p>

            <form id="editForm" novalidate>
                <?php foreach ($formDefinition['fields'] as $field): ?>
                    <?php
                        $key = e($field['key']);
                        $label = e($field['label']);
                        $required = !empty($field['required']);
                        $placeholder = isset($field['placeholder']) ? e($field['placeholder']) : '';
                        $type = $field['type'] ?? 'text';
                        $current = $answers[$field['key']] ?? '';
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
                            ><?php echo is_string($current) ? e($current) : ''; ?></textarea>
                        <?php elseif ($type === 'checkboxes' && !empty($field['options']) && is_array($field['options'])): ?>
                            <div class="checkbox-group">
                                <?php
                                    $currentValues = is_array($current) ? $current : [];
                                ?>
                                <?php foreach ($field['options'] as $option): ?>
                                    <?php $optionSafe = e($option); ?>
                                    <label class="checkbox-item">
                                        <input
                                            type="checkbox"
                                            name="<?php echo $key; ?>"
                                            value="<?php echo $optionSafe; ?>"
                                            <?php echo in_array($option, $currentValues, true) ? 'checked' : ''; ?>
                                        />
                                        <span><?php echo $optionSafe; ?></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        <?php elseif ($type === 'select' && !empty($field['options']) && is_array($field['options'])): ?>
                            <select id="<?php echo $key; ?>" name="<?php echo $key; ?>" <?php echo $required ? 'required' : ''; ?>>
                                <option value="">選択してください</option>
                                <?php foreach ($field['options'] as $option): ?>
                                    <option value="<?php echo e($option); ?>" <?php echo ($current === $option) ? 'selected' : ''; ?>><?php echo e($option); ?></option>
                                <?php endforeach; ?>
                            </select>
                        <?php else: ?>
                            <input
                                id="<?php echo $key; ?>"
                                name="<?php echo $key; ?>"
                                type="<?php echo e($type); ?>"
                                <?php echo $required ? 'required' : ''; ?>
                                placeholder="<?php echo $placeholder; ?>"
                                value="<?php echo is_string($current) ? e($current) : ''; ?>"
                            />
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>

                <input type="hidden" name="id" value="<?php echo (int)$row['id']; ?>">
                <div class="actions">
                    <button type="submit" id="submitButton">更新する</button>
                    <div class="status" id="status"></div>
                </div>
                <p class="helper">更新後、最新の内容で上書き保存されます。</p>
                <p class="helper"><a href="history.php">履歴一覧に戻る</a></p>
            </form>
        </div>
    </div>

    <script>
        const form = document.getElementById('editForm');
        const statusEl = document.getElementById('status');
        const submitBtn = document.getElementById('submitButton');

        function setStatus(message, type = '') {
            statusEl.textContent = message || '';
            statusEl.className = `status ${type}`;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setStatus('', '');
            submitBtn.disabled = true;
            setStatus('更新中...', '');

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

            try {
                const response = await fetch('api/update.php', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (!response.ok || !result.ok) {
                    throw new Error(result.message || '更新に失敗しました。');
                }

                setStatus(result.message || '更新しました。', 'success');
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
    </script>
</body>
</html>
