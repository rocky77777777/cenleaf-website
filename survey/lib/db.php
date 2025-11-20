<?php

function getDb(PDO &$pdo = null): PDO
{
    global $databasePath;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('SQLite driver is not available on this server.');
    }

    $dbDir = dirname($databasePath);
    if (!is_dir($dbDir) || !is_writable($dbDir)) {
        throw new RuntimeException("Database directory is not writable: {$dbDir}");
    }

    $pdo = new PDO('sqlite:' . $databasePath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON;');
    $pdo->exec('PRAGMA journal_mode = WAL;');

    $pdo->exec('CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        data TEXT NOT NULL
    );');

    return $pdo;
}

function saveResponse(array $payload): void
{
    $pdo = getDb();
    $stmt = $pdo->prepare('INSERT INTO responses (data) VALUES (:data)');
    $stmt->execute([':data' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
}

function fetchResponses(): array
{
    $pdo = getDb();
    $stmt = $pdo->query('SELECT id, submitted_at, data FROM responses ORDER BY id DESC');
    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $row['data'] = json_decode($row['data'], true) ?: [];
        $rows[] = $row;
    }
    return $rows;
}

function fetchResponseById(int $id): ?array
{
    $pdo = getDb();
    $stmt = $pdo->prepare('SELECT id, submitted_at, data FROM responses WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }
    $row['data'] = json_decode($row['data'], true) ?: [];
    return $row;
}

function fetchResponsesByOperator(string $operator): array
{
    // 小規模想定のため、メモリフィルタで対応
    $all = fetchResponses();
    return array_values(array_filter($all, function ($row) use ($operator) {
        return ($row['data']['meta']['operator'] ?? '') === $operator;
    }));
}

function updateResponse(int $id, array $payload): void
{
    $pdo = getDb();
    $stmt = $pdo->prepare('UPDATE responses SET data = :data WHERE id = :id');
    $stmt->execute([
        ':data' => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ':id' => $id,
    ]);
}
