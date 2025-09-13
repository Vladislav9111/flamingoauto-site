// Создание поста через GitHub API (без локальных файлов)
exports.handler = async (event, context) => {
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
    // Проверяем авторизацию
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

    const token = authHeader.replace('Bearer ', '');
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
    const dateStr = date.toISOString().split('T')[0];
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

    // Кодируем в base64
    const encodedContent = Buffer.from(markdownContent, 'utf8').toString('base64');

    // Отправляем в GitHub API
    const githubResponse = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/content/blog/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN || 'no-token'}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Flamingo-Auto-Blog'
      },
      body: JSON.stringify({
        message: `Новая статья: ${title}`,
        content: encodedContent,
        branch: 'main'
      })
    });

    if (githubResponse.ok) {
      const result = await githubResponse.json();
      console.log('✅ Post created via GitHub API:', filename);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          message: 'Post created via GitHub API',
          filename: filename,
          sha: result.content.sha
        }),
      };
    } else {
      const errorText = await githubResponse.text();
      console.error('❌ GitHub API error:', githubResponse.status, errorText);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'GitHub API failed',
          details: errorText,
          status: githubResponse.status
        }),
      };
    }

  } catch (error) {
    console.error('❌ Error creating post via GitHub API:', error);
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