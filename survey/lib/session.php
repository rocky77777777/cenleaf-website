<?php
/**
 * Session bootstrap for the survey app.
 * Centralizes cookie settings so every entry point behaves consistently.
 */

function surveyCookiePath(): string
{
    $appBaseDir = basename(dirname(__DIR__));
    return $appBaseDir ? '/' . trim($appBaseDir, '/') . '/' : '/';
}

function startSurveySession(): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $cookiePath = surveyCookiePath();

    session_set_cookie_params([
        'lifetime' => 60 * 60 * 12, // 12 hours
        'path' => $cookiePath,
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_cache_limiter('nocache');
    session_start();
}
