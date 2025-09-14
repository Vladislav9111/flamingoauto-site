# Flamingo Auto - Configuration Setup

## 🎯 Новая админка (обновлено!)

✅ **Переделана админка по образцу из архива!**

### Быстрый старт:
1. Откройте: [admin.html](admin.html)
2. Нажмите "🔑 Войти" 
3. Авторизуйтесь через Netlify Identity
4. Создайте статью и нажмите "💾 Сохранить"

**Статья сохранится прямо в GitHub и появится в блоге!**

📋 **Что изменилось:**
- Простой интерфейс как в архиве
- Авторизация через Netlify Identity  
- Прямое сохранение в GitHub (не через CMS)
- Поддержка фотографий и выбор языка

🧪 **Тестирование:** [test-new-admin.html](test-new-admin.html)

---

## 🔐 Настройка конфигурации для разработки

### 1. Создайте локальный файл конфигурации:

```bash
cp config.example.js config.js
```

### 2. Заполните реальными данными:

```javascript
// config.js
export const BOT_TOKEN = 'ваш_реальный_токен_telegram_бота';
export const CHAT_ID = 'ваш_реальный_chat_id';
export const GITHUB_TOKEN = 'ваш_github_токен_для_админки';
```

### 3. Получение данных Telegram:

#### Создание бота:
1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Получите токен бота

#### Получение Chat ID:
1. Добавьте бота в группу или начните с ним чат
2. Отправьте сообщение боту
3. Откройте: `https://api.telegram.org/bot<ВАШ_ТОКЕН>/getUpdates`
4. Найдите `chat.id` в ответе

## 🚀 Настройка продакшн (Netlify)

### Переменные окружения в Netlify:

1. Перейдите в настройки сайта → Environment variables
2. Добавьте:
   - `TELEGRAM_BOT_TOKEN` = ваш токен
   - `TELEGRAM_CHAT_ID` = ваш chat id

### Netlify Identity:

1. Site settings → Identity → Enable Identity
2. Identity → Services → Git Gateway → Enable Git Gateway  
3. Identity → Invite users → добавьте администраторов

## 📂 Файлы конфигурации

- `config.js` - **НЕ коммитится** (в .gitignore)
- `config.example.js` - Шаблон для разработчиков
- `.gitignore` - Защищает чувствительные данные

## 🛠️ Разработка

Локально сайт будет использовать `config.js`, на Netlify - переменные окружения.