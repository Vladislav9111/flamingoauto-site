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

Замените в `admin.html` строку:
```javascript
const GITHUB_TOKEN = 'ghp_Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';
```

На:
```javascript
const GITHUB_TOKEN = 'ваш_реальный_токен_здесь';
```

### 3. Альтернативный способ (через config.js):

Обновите `config.js`:
```javascript
export const GITHUB_TOKEN = 'ваш_реальный_токен_здесь';
```

И в `admin.html` измените на:
```javascript
import { GITHUB_TOKEN } from './config.js';
```

## ⚠️ ВАЖНО:
- НЕ коммитьте реальный токен в Git!
- Добавьте `config.js` в `.gitignore`
- Токен дает полный доступ к вашим репозиториям

## 🧪 Проверка:
После обновления токена админка сможет сохранять посты в GitHub.

---

**Текущий репозиторий исправлен на:** `Vladislav9111/flamingoauto-site` ✅