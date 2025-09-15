// Безопасная конфигурация для админки
// НЕ КОММИТЬТЕ ЭТОТ ФАЙЛ С РЕАЛЬНЫМИ ТОКЕНАМИ!

// Проверяем переменные окружения (если доступны)
const getEnvVar = (name, fallback = '') => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[name] || fallback;
    }
    return fallback;
};

// GitHub токен (замените на реальный)
export const GITHUB_TOKEN = getEnvVar('GITHUB_TOKEN', 'your_github_token_here');

// Telegram настройки
export const BOT_TOKEN = getEnvVar('BOT_TOKEN', 'your_telegram_bot_token_here');
export const CHAT_ID = getEnvVar('CHAT_ID', 'your_telegram_chat_id_here');

// Проверка конфигурации
export function validateConfig() {
    const errors = [];
    
    if (!GITHUB_TOKEN || GITHUB_TOKEN === 'your_github_token_here') {
        errors.push('GitHub токен не настроен');
    }
    
    if (!BOT_TOKEN || BOT_TOKEN === 'your_telegram_bot_token_here') {
        errors.push('Telegram Bot токен не настроен');
    }
    
    if (!CHAT_ID || CHAT_ID === 'your_telegram_chat_id_here') {
        errors.push('Telegram Chat ID не настроен');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}