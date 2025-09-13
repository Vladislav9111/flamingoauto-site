# 🚀 Настройка Netlify для публикации статей

## Проблема
Статьи не публикуются через админку, хотя форма отправляется.

## Диагностика
1. Откройте `test-publish.html` в браузере
2. Войдите через Netlify Identity
3. Протестируйте все три способа публикации

## Настройка Netlify Identity

### 1. Включите Identity в Netlify Dashboard
1. Зайдите в [Netlify Dashboard](https://app.netlify.com)
2. Выберите ваш сайт `flamingoauto`
3. Перейдите в **Identity** → **Enable Identity**
4. В **Settings and usage** → **Registration preferences** выберите **Invite only**
5. В **Git Gateway** нажмите **Enable Git Gateway**

### 2. Создайте пользователя
1. В разделе **Identity** нажмите **Invite users**
2. Добавьте свой email
3. Проверьте почту и завершите регистрацию

### 3. Настройте роли (опционально)
1. В **Identity** → **Settings and usage** → **Roles**
2. Добавьте роль `admin` для администраторов

## Настройка Git Gateway

Git Gateway должен быть включен для работы с GitHub:

1. В Netlify Dashboard → **Identity** → **Services**
2. Нажмите **Enable Git Gateway**
3. Убедитесь что указан правильный репозиторий: `Vladislav9111/flamingoauto-site`

## Проверка настроек

### Способ 1: Netlify Function (рекомендуется)
- Создает файлы напрямую на сервере
- Не зависит от Git Gateway
- Работает быстрее

### Способ 2: Git Gateway
- Использует GitHub API через Netlify
- Требует правильной настройки Identity
- Создает коммиты в GitHub

### Способ 3: Netlify CMS
- Полноценная CMS система
- Доступна по адресу `/admin/`
- Использует Git Gateway

## Устранение неполадок

### Ошибка 401 (Unauthorized)
- Проверьте что вы авторизованы в Netlify Identity
- Убедитесь что Git Gateway включен
- Проверьте права доступа к репозиторию

### Ошибка 404 (Not Found)
- Проверьте что Netlify Functions развернуты
- Убедитесь что папка `netlify/functions` загружена
- Проверьте логи в Netlify Dashboard

### Ошибка 500 (Server Error)
- Проверьте логи Netlify Functions
- Убедитесь что зависимости установлены (`gray-matter`)
- Проверьте права записи в папку `content/blog`

## Альтернативные решения

### 1. Прямое редактирование файлов
Создавайте файлы `.md` напрямую в папке `content/blog/`:

```markdown
---
title: "Заголовок статьи"
date: 2025-09-13T10:00:00.000Z
excerpt: "Краткое описание"
author: "Flamingo Auto"
locale: "ru"
published: true
---

Содержимое статьи...
```

### 2. Использование Netlify CMS
Откройте `/admin/` для полноценной CMS системы.

### 3. GitHub напрямую
Создавайте файлы через GitHub веб-интерфейс в папке `content/blog/`.

## Тестирование

После настройки:
1. Откройте `test-publish.html`
2. Войдите в систему
3. Протестируйте все способы публикации
4. Проверьте что файлы создаются в `content/blog/`
5. Убедитесь что статьи отображаются на сайте