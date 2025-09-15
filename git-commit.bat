@echo off
cd /d "D:\Воркзилла\Netlify блог"
git add blog.html
git commit -m "Fix blog: add GitHub API integration + fallback articles"
git push origin main
echo Done!
pause