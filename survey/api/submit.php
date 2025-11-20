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

$clean = [];
$errors = [];

// 担当者（クライアント側で入力 → metaに格納）
$operatorName = $_SESSION['survey_operator'] ?? '';
if (empty($_SESSION['survey_authenticated']) || $operatorName === '') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => '担当者のログイン情報を入力してください。']);
    exit;
}

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
        'operator_email' => $_SESSION['survey_operator_email'] ?? '',
    ],
];

try {
    saveResponse($payload);
    echo json_encode([
        'ok' => true,
        'message' => $formDefinition['thank_you_message'] ?? '送信ありがとうございました。',
    ]);
} catch (Throwable $e) {
    error_log('[survey submit] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'サーバーでエラーが発生しました。']);
}
