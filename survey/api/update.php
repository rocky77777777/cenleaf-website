<?php
require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/session.php';
require __DIR__ . '/../lib/db.php';

startSurveySession();

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!is_array($data)) {
    $data = $_POST;
}

$id = isset($data['id']) ? (int)$data['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'IDが不正です。']);
    exit;
}

$operatorName = $_SESSION['survey_operator'] ?? '';
$operatorEmail = $_SESSION['survey_operator_email'] ?? '';
if (empty($_SESSION['survey_authenticated']) || $operatorName === '') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'ログイン情報が無効です。再ログインしてください。']);
    exit;
}

$existing = fetchResponseById($id);
if (!$existing) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => '対象データが見つかりません。']);
    exit;
}

$existingOperator = $existing['data']['meta']['operator'] ?? '';
if ($existingOperator !== $operatorName) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'このデータを編集する権限がありません。']);
    exit;
}

$clean = [];
$errors = [];

foreach ($formDefinition['fields'] as $field) {
    $key = $field['key'];
    $required = !empty($field['required']);
    $type = $field['type'] ?? 'text';
    $options = $field['options'] ?? [];

    $valueRaw = $data[$key] ?? '';
    $value = null;

    if ($type === 'checkboxes') {
        if (is_array($valueRaw)) {
            $value = array_values(array_filter(array_map('trim', $valueRaw), 'strlen'));
        } elseif (is_string($valueRaw) && $valueRaw !== '') {
            $value = [trim($valueRaw)];
        } else {
            $value = [];
        }

        if ($required && count($value) === 0) {
            $errors[] = "{$field['label']}は必須です。";
            continue;
        }

        if ($options) {
            foreach ($value as $selected) {
                if (!in_array($selected, $options, true)) {
                    $errors[] = "{$field['label']}の選択肢が不正です。";
                    break;
                }
            }
        }
    } else {
        $stringValue = is_string($valueRaw) ? trim($valueRaw) : '';

        if ($required && $stringValue === '') {
            $errors[] = "{$field['label']}は必須です。";
            continue;
        }

        if ($stringValue !== '') {
            if ($type === 'email' && !filter_var($stringValue, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "{$field['label']}の形式を確認してください。";
            }
            if ($type === 'select' && $options && !in_array($stringValue, $options, true)) {
                $errors[] = "{$field['label']}の選択肢が不正です。";
            }
        }

        $value = $stringValue;
    }

    $clean[$key] = $value;
}

if ($errors) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => implode(' ', $errors)]);
    exit;
}

$payload = [
    'answers' => $clean,
    'meta' => [
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        'operator' => $operatorName,
        'operator_email' => $operatorEmail,
        'updated_at' => date('c'),
    ],
];

try {
    updateResponse($id, $payload);
    echo json_encode([
        'ok' => true,
        'message' => '更新しました。',
    ]);
} catch (Throwable $e) {
    error_log('[survey update] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'サーバーでエラーが発生しました。']);
}
