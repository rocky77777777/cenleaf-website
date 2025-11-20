<?php
require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/db.php';

$password = $_GET['password'] ?? '';

if (!$adminPassword || $password !== $adminPassword) {
    http_response_code(401);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['ok' => false, 'message' => '認証に失敗しました。管理用パスワードを確認してください。']);
    exit;
}

$responses = fetchResponses();
$fields = $formDefinition['fields'] ?? [];

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="survey-responses.csv"');

$output = fopen('php://output', 'w');

// UTF-8 BOM for Excel compatibility
fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

$headers = ['ID', 'Submitted At', 'Operator', 'Operator Email'];
foreach ($fields as $field) {
    $headers[] = $field['label'];
}
fputcsv($output, $headers);

foreach ($responses as $row) {
    $operator = $row['data']['meta']['operator'] ?? '';
    $operatorEmail = $row['data']['meta']['operator_email'] ?? '';
    $line = [$row['id'], $row['submitted_at'], $operator, $operatorEmail];
    foreach ($fields as $field) {
        $key = $field['key'];
        $line[] = $row['data']['answers'][$key] ?? '';
    }
    fputcsv($output, $line);
}

fclose($output);
