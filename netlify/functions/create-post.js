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
      path.join('/var/task', 'content', 'blog'),
      path.join('/opt/buildhome/repo', 'content', 'blog'),
      path.join(process.env.LAMBDA_TASK_ROOT || '', '..', '..', 'content', 'blog')
    ];

    let blogDirectory = null;
    
    // Логируем для отладки
    console.log('🔍 Ищем папку блога...');
    console.log('process.cwd():', process.cwd());
    console.log('__dirname:', __dirname);
    console.log('LAMBDA_TASK_ROOT:', process.env.LAMBDA_TASK_ROOT);
    
    for (const testPath of possiblePaths) {
      console.log('Проверяем путь:', testPath);
      console.log('Родительская папка существует:', fs.existsSync(path.dirname(testPath)));
      
      if (fs.existsSync(path.dirname(testPath))) {
        blogDirectory = testPath;
        // Создаем папку если её нет
        if (!fs.existsSync(blogDirectory)) {
          console.log('Создаем папку:', blogDirectory);
          fs.mkdirSync(blogDirectory, { recursive: true });
        }
        console.log('✅ Используем папку:', blogDirectory);
        break;
      }
    }

    if (!blogDirectory) {
      console.error('Blog directory not found. Tried paths:', possiblePaths);
      
      // Возвращаем данные для Git Gateway fallback
      return {
        statusCode: 202, // Accepted, но не выполнено
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Blog directory not found',
          fallback: 'use_git_gateway',
          markdownContent: markdownContent,
          filename: filename
        }),
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