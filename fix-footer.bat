@echo off
cd /d "D:\Воркзилла\Netlify блог"
git add index.html ru.html
git commit -m "Remove year from footer text in all versions"
git push origin main
echo Done!
pause