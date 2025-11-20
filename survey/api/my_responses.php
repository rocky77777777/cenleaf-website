<?php
require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/session.php';
require __DIR__ . '/../lib/db.php';

startSurveySession();

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$operatorName = $_SESSION['survey_operator'] ?? '';
if (empty($_SESSION['survey_authenticated']) || $operatorName === '') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'ログイン情報が無効です。再ログインしてください。']);
    exit;
}

try {
    $responses = fetchResponsesByOperator($operatorName);
    echo json_encode(['ok' => true, 'data' => $responses]);
} catch (Throwable $e) {
    error_log('[survey my_responses] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'サーバーでエラーが発生しました。']);
}
