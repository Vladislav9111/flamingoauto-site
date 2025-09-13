const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

exports.handler = async (event, context) => {
  try {
    // Пробуем разные возможные пути к папке с постами
    const possiblePaths = [
      path.join(process.cwd(), 'content', 'blog'),
      path.join(__dirname, '..', '..', 'content', 'blog'),
      path.join('/opt/build/repo', 'content', 'blog'),
      path.join('/var/task', 'content', 'blog')
    ];

    let postsDirectory = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        postsDirectory = testPath;
        break;
      }
    }

    // Если папка не найдена, возвращаем пустой массив
    if (!postsDirectory) {
      console.log('Posts directory not found. Tried paths:', possiblePaths);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify([]),
      };
    }

    console.log('Found posts directory at:', postsDirectory);

    // Читаем все .md файлы
    const filenames = fs.readdirSync(postsDirectory).filter(name => name.endsWith('.md'));
    console.log('Found markdown files:', filenames);

    const posts = filenames.map(filename => {
      const filePath = path.join(postsDirectory, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);
      console.log('Processing file:', filename, 'with data:', data);
      
      return {
        id: filename.replace('.md', ''),
        title: data.title || 'Без названия',
        excerpt: data.excerpt || data.description || '',
        content: content || '',
        author: data.author || 'Flamingo Auto',
        date: data.date || new Date().toISOString(),
        locale: data.locale || data.lang || 'all',
        published: data.published !== false,
        photos: data.images || data.photos || [] // Поддерживаем оба формата
      };
    });

    // Фильтруем только опубликованные посты и сортируем по дате
    const publishedPosts = posts
      .filter(post => post.published)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('Returning published posts:', publishedPosts.length, 'posts');

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