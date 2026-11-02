@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"

echo ======================================================
echo  [소식지 터 - 매거진] 안드로이드 앱 동기화 및 Git 배포
echo ======================================================

echo [1/2] 안드로이드 앱(test_ter_android) 에셋 동기화 중...
copy /Y "index.html" "D:\부동산업무\antigravity\test_ter_android\app\src\main\assets\index.html" > nul
copy /Y "app.js" "D:\부동산업무\antigravity\test_ter_android\app\src\main\assets\app.js" > nul
copy /Y "style.css" "D:\부동산업무\antigravity\test_ter_android\app\src\main\assets\style.css" > nul

echo [2/2] Git 저장소 커밋 및 푸시 중...
git add index.html app.js style.css
git commit -m "chore(ter-magazine): sync latest magazine files"
git push origin main

echo.
echo ======================================================
echo  ✨ 소식지 터(매거진) 동기화 및 배포가 완료되었습니다!
echo ======================================================
