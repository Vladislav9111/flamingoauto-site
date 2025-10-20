// netlify/functions/get-config.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // НИЧЕГО секретного не выдаём
  const body = {
    hasGithubToken: !!process.env.GITHUB_TOKEN,
    repoOwner: process.env.GITHUB_REPO_OWNER || null,
    repoName: process.env.GITHUB_REPO_NAME || null
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
};
