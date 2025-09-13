const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Проверяем авторизацию через Netlify Identity
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Парсим данные поста
    const postData = JSON.parse(event.body);
    const { title, content, author, locale, photos } = postData;

    if (!title || !content) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Title and content are required' }),
      };
    }

    // Создаем имя файла
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const slug = title.toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const filename = `${dateStr}-${slug}.md`;

    // Создаем содержимое markdown файла
    const markdownContent = `---
title: "${title}"
date: ${date.toISOString()}
excerpt: "${title}"
author: "${author || 'Flamingo Auto'}"
locale: "${locale || 'all'}"
published: true
---

${content}`;

    // Определяем путь к папке блога
    const possiblePaths = [
      path.join(process.cwd(), 'content', 'blog'),
      path.join(__dirname, '..', '..', 'content', 'blog'),
      path.join('/opt/build/repo', 'content', 'blog'),
      path.join('/var/task', 'content', 'blog')
    ];

    let blogDirectory = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(path.dirname(testPath))) {
        blogDirectory = testPath;
        // Создаем папку если её нет
        if (!fs.existsSync(blogDirectory)) {
          fs.mkdirSync(blogDirectory, { recursive: true });
        }
        break;
      }
    }

    if (!blogDirectory) {
      console.error('Blog directory not found. Tried paths:', possiblePaths);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Blog directory not found' }),
      };
    }

    // Записываем файл
    const filePath = path.join(blogDirectory, filename);
    fs.writeFileSync(filePath, markdownContent, 'utf8');

    console.log('✅ Post created:', filePath);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Post created successfully',
        filename: filename,
        path: filePath
      }),
    };

  } catch (error) {
    console.error('❌ Error creating post:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to create post',
        details: error.message
      }),
    };
  }
};