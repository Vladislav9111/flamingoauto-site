# 🔑 Настройка GitHub Token для Netlify

## Проблема
Статьи публикуются только локально, не сохраняются в GitHub.

## Решение: Настройка GitHub Personal Access Token

### 1. Создание GitHub Token

1. Зайдите в GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Нажмите **Generate new token (classic)**
3. Заполните:
   - **Note**: `Netlify Blog Publishing`
   - **Expiration**: `No expiration` (или выберите срок)
   - **Scopes**: Выберите `repo` (полный доступ к репозиториям)
4. Нажмите **Generate token**
5. **ВАЖНО**: Скопируйте токен сразу! Он больше не будет показан.

### 2. Добавление токена в Netlify

1. Зайдите в [Netlify Dashboard](https://app.netlify.com)
2. Выберите ваш сайт `flamingoauto`
3. Перейдите в **Site settings** → **Environment variables**
4. Нажмите **Add variable**
5. Заполните:
   - **Key**: `GITHUB_TOKEN`
   - **Value**: Вставьте скопированный GitHub токен
   - **Scopes**: `All scopes`
6. Нажмите **Create variable**

### 3. Перезапуск деплоя

После добавления переменной:
1. Перейдите в **Deploys**
2. Нажмите **Trigger deploy** → **Deploy site**
3. Дождитесь завершения деплоя

### 4. Проверка работы

1. Откройте `test-publish.html` на вашем сайте
2. Войдите через Netlify Identity
3. Протестируйте все способы публикации
4. Проверьте что файлы появляются в GitHub репозитории

## Альтернативные способы

### Способ 1: Git Gateway (рекомендуется)
- Не требует GitHub токена
- Использует Netlify Identity
- Нужно включить в Netlify Dashboard → Identity → Git Gateway

### Способ 2: Netlify CMS
- Откройте `/admin/` на вашем сайте
- Полноценная система управления контентом
- Работает через Git Gateway

### Способ 3: Прямое редактирование
- Создавайте файлы `.md` прямо в GitHub
- Папка: `content/blog/`
- Формат имени: `YYYY-MM-DD-название.md`

## Диагностика проблем

### Ошибка 401 (Unauthorized)
- Проверьте что вы авторизованы в Netlify Identity
- Убедитесь что Git Gateway включен
- Проверьте GitHub токен

### Ошибка 404 (Not Found)
- Проверьте что Netlify Functions развернуты
- Убедитесь что переменная GITHUB_TOKEN добавлена
- Проверьте что репозиторий существует

### Статьи не появляются на сайте
- Проверьте что файлы создались в GitHub
- Убедитесь что Netlify автоматически деплоит изменения
- Проверьте формат frontmatter в статьях

## Безопасность

⚠️ **ВАЖНО**: 
- Никогда не публикуйте GitHub токен в коде
- Используйте только переменные окружения Netlify
- Регулярно обновляйте токены
- Ограничивайте права токена только необходимыми репозиториями