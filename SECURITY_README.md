# 🔒 Безопасность конфигурации

## Защищенные файлы:

### ✅ config.js - ЗАЩИЩЕН
- Добавлен в `.gitignore`
- НЕ попадает в Git репозиторий
- Содержит реальные токены и пароли

### ✅ config.example.js - ПУБЛИЧНЫЙ
- Шаблон для создания config.js
- Содержит только примеры
- Безопасно хранить в Git

## Как настроить:

1. **Скопируйте шаблон:**
   ```bash
   cp config.example.js config.js
   ```

2. **Заполните реальными данными:**
   ```javascript
   export const GITHUB_TOKEN = 'ваш_реальный_токен';
   export const BOT_TOKEN = 'ваш_telegram_токен';
   export const CHAT_ID = 'ваш_chat_id';
   ```

3. **Проверьте .gitignore:**
   ```
   # Configuration files with sensitive data
   config.js
   ```

## ⚠️ НИКОГДА НЕ КОММИТЬТЕ:
- Реальные API токены
- Пароли
- Приватные ключи
- Персональные данные

## 🛡️ Что защищено:
- ✅ GitHub Personal Access Token
- ✅ Telegram Bot Token  
- ✅ Chat ID
- ✅ Другие чувствительные данные

---

**Безопасность - приоритет! 🔐**