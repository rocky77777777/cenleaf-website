<?php
require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/session.php';
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

$name = isset($data['operator_name']) ? trim((string)$data['operator_name']) : '';
$email = isset($data['operator_email']) ? trim((string)$data['operator_email']) : '';
$password = isset($data['operator_password']) ? trim((string)$data['operator_password']) : '';

if ($name === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => '担当者名・メールアドレス・パスワードを入力してください。']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'メールアドレスの形式を確認してください。']);
    exit;
}

if ($password !== $adminPassword) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'パスワードが正しくありません。']);
    exit;
}

session_regenerate_id(true);
$_SESSION['survey_authenticated'] = true;
$_SESSION['survey_operator'] = $name;
$_SESSION['survey_operator_email'] = $email;
$_SESSION['survey_login_time'] = time();

// Cookieも併用してリダイレクト判定を強化（12時間有効）
$cookiePath = surveyCookiePath();
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
setcookie(
    'survey_auth',
    '1',
    [
        'expires' => time() + 60 * 60 * 12,
        'path' => $cookiePath,
        'secure' => $secure,
        'httponly' => false, // フロントからも参照するため
        'samesite' => 'Lax',
    ]
);

echo json_encode(['ok' => true, 'operator' => $name]);
