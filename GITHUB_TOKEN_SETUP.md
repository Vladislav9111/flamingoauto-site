# 🔑 Настройка GitHub токена для админки

## Проблема:
❌ **Bad credentials** - используется фейковый GitHub токен

## Решение:

### 1. Создайте GitHub Personal Access Token:

1. Откройте: https://github.com/settings/tokens
2. Нажмите **"Generate new token"** → **"Generate new token (classic)"**
3. Заполните:
   - **Note**: `Flamingo Auto Admin`
   - **Expiration**: `No expiration` (или выберите срок)
   - **Scopes**: отметьте `repo` (полный доступ к репозиториям)
4. Нажмите **"Generate token"**
5. **СКОПИРУЙТЕ ТОКЕН** (он показывается только один раз!)

### 2. Обновите токен в админке:

Откройте файл `admin.html` и найдите строку:
```javascript
const GITHUB_TOKEN = '[REMOVED_LEGACY_CREDENTIAL]';
```

Замените на ваш реальный токен:
```javascript
const GITHUB_TOKEN = 'ghp_ваш_реальный_токен_здесь';
```

### 3. Безопасный способ (рекомендуется):

1. Скопируйте `config.example.js` как `config.js`
2. Заполните реальными токенами в `config.js`
3. Измените `admin.html` чтобы использовать config.js:
   ```javascript
   // Замените строку с токеном на:
   import { GITHUB_TOKEN } from './config.js';
   ```

## ⚠️ БЕЗОПАСНОСТЬ:

- ✅ `config.js` уже добавлен в `.gitignore`
- ✅ Реальные токены НЕ попадут в Git
- ✅ Используйте `config.example.js` как шаблон
- ❌ НЕ коммитьте реальные токены!

## 🧪 Проверка:
После обновления токена админка сможет сохранять посты в GitHub.

---

**Репозиторий:** `Vladislav9111/flamingoauto-site` ✅  
**Безопасность:** config.js защищен .gitignore ✅