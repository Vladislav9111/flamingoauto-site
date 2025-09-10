const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

exports.handler = async (event, context) => {
  try {
    const postsDirectory = path.join(process.cwd(), 'content', 'blog');
    
    // Проверяем существование папки
    if (!fs.existsSync(postsDirectory)) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify([]),
      };
    }

    // Читаем все .md файлы
    const filenames = fs.readdirSync(postsDirectory).filter(name => name.endsWith('.md'));
    
    const posts = filenames.map(filename => {
      const filePath = path.join(postsDirectory, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);
      
      return {
        id: filename.replace('.md', ''),
        title: data.title || 'Без названия',
        excerpt: data.excerpt || '',
        content: content || '',
        author: data.author || 'Администратор',
        date: data.date || new Date().toISOString(),
        locale: data.locale || 'all',
        published: data.published !== false,
        photos: data.images || data.photos || [] // Поддерживаем оба формата
      };
    });

    // Фильтруем только опубликованные посты и сортируем по дате
    const publishedPosts = posts
      .filter(post => post.published)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(publishedPosts),
    };
  } catch (error) {
    console.error('Error loading posts:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to load posts' }),
    };
  }
};