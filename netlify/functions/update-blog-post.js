// Netlify Function для обновления поста
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { post, filename, sha } = JSON.parse(event.body);
    
    // Валидация
    if (!post.title || !post.excerpt || !filename || !sha) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Обновляем дату изменения
    post.updated = new Date().toISOString();

    // Определяем папку и формат по расширению файла
    const folder = filename.endsWith('.json') ? 'content/posts' : 'content/blog';
    let content, encodedContent;
    
    if (filename.endsWith('.json')) {
      // JSON формат
      content = JSON.stringify(post, null, 2);
      encodedContent = Buffer.from(content, 'utf8').toString('base64');
    } else {
      // Markdown формат
      const frontmatter = `---
title: "${post.title}"
date: ${post.created}
author: ${post.author}
published: true
locale: ${post.locale}
excerpt: "${post.excerpt}"
---

${post.content}`;
      content = frontmatter;
      encodedContent = Buffer.from(content, 'utf8').toString('base64');
    }

    const githubResponse = await fetch(`https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/${folder}/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Flamingo-Auto-Admin'
      },
      body: JSON.stringify({
        message: `Update blog post: ${post.title}`,
        content: encodedContent,
        sha: sha,
        committer: {
          name: 'Flamingo Auto Admin',
          email: 'admin@flamingoauto.eu'
        }
      })
    });

    if (!githubResponse.ok) {
      const error = await githubResponse.json();
      throw new Error(error.message || 'GitHub API error');
    }

    const result = await githubResponse.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        filename: filename,
        sha: result.content.sha 
      })
    };

  } catch (error) {
    console.error('Update post error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
};