# 🔑 Настройка Netlify Identity и Git Gateway

## Проблема: CMS открывается, но нет кнопки "New Blog Post"

Это означает, что Netlify Identity работает, но Git Gateway не настроен или у пользователя нет прав.

## 🚀 Пошаговая настройка:

### 1. Настройка Netlify Identity

1. **Откройте панель Netlify:** https://app.netlify.com
2. **Выберите сайт:** `flamingoauto` или `flamingoauto-site`
3. **Перейдите в:** `Site settings` → `Identity`

### 2. Включение Identity

1. **Нажмите:** `Enable Identity`
2. **В разделе Registration:**
   - Выберите `Open` (для открытой регистрации)
   - Или `Invite only` (только по приглашениям)
3. **В разделе External providers:**
   - Можно включить Google, GitHub, GitLab для входа

### 3. Настройка Git Gateway

1. **В том же разделе Identity перейдите в:** `Services`
2. **Нажмите:** `Enable Git Gateway`
3. **Убедитесь, что:**
   - Репозиторий `Vladislav9111/flamingoauto-site` подключен
   - У вас есть права на запись в репозиторий

### 4. Создание пользователя

1. **Перейдите в:** `Identity` → `Users`
2. **Нажмите:** `Invite users`
3. **Введите email** администратора сайта
4. **Отправьте приглашение**

### 5. Настройка ролей (опционально)

1. **В разделе Users** найдите пользователя
2. **Нажмите на пользователя** → `Edit user metadata`
3. **Добавьте роли:**
   ```json
   {
     "roles": ["admin", "editor"]
   }
   ```

## 🔧 Проверка настроек

### Проверьте файл netlify.toml:

```toml
[build]
  publish = "."

# Убедитесь, что есть редиректы для админки
[[redirects]]
  from = "/admin"
  to = "/admin/"
  status = 301

[[redirects]]
  from = "/admin/*"
  to = "/admin/:splat"
  status = 200
```

### Проверьте config.yml:

```yaml
backend:
  name: git-gateway
  branch: main
  repo: Vladislav9111/flamingoauto-site  # Добавьте эту строку если её нет

# Остальная конфигурация...
```

## 🚨 Частые проблемы и решения:

### 1. "Config Errors" в CMS
**Причина:** Ошибки в config.yml
**Решение:** Используйте упрощенную конфигурацию через `/admin/switch-config.html`

### 2. "Not Found" при открытии CMS
**Причина:** Неправильные редиректы
**Решение:** Проверьте netlify.toml и _redirects

### 3. CMS загружается, но пустой
**Причина:** Git Gateway не настроен или нет прав
**Решение:** Выполните шаги 1-4 выше

### 4. "Authentication Error"
**Причина:** Пользователь не авторизован
**Решение:** Войдите через Netlify Identity

## 📋 Чек-лист для проверки:

- [ ] Netlify Identity включен
- [ ] Git Gateway включен и настроен
- [ ] Репозиторий подключен правильно
- [ ] Пользователь создан и приглашен
- [ ] Пользователь авторизован в системе
- [ ] Файл config.yml корректен
- [ ] Редиректы настроены в netlify.toml
- [ ] Папка content/blog существует

## 🔗 Полезные ссылки:

- [Документация Netlify Identity](https://docs.netlify.com/visitor-access/identity/)
- [Документация Git Gateway](https://docs.netlify.com/visitor-access/git-gateway/)
- [Документация Netlify CMS](https://decapcms.org/docs/)

## 🆘 Если ничего не помогает:

1. **Попробуйте упрощенную конфигурацию:** `/admin/switch-config.html`
2. **Запустите диагностику:** `/debug-cms.html`
3. **Используйте альтернативную админку:** `/admin.html`
4. **Проверьте консоль браузера** (F12) на ошибки
5. **Обратитесь к администратору** с результатами диагностики