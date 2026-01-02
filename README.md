# Fireworks 2026 Deploy

## GitHub Pages
- 初始化 Git 仓库并推送到 GitHub：
  - `git init`
  - `git add . && git commit -m "init fireworks"`
  - 创建远程仓库后：`git remote add origin <your_repo_url>`
  - `git branch -M main && git push -u origin main`
- 在仓库 Settings → Pages 中选择 Source: GitHub Actions。
- 工作流位于 `.github/workflows/deploy.yml`，推送到 `main` 后自动部署。

## Netlify
- 登录 Netlify，选择 "Add new site" → "Deploy manually" 或 "Import from Git"。
- 若走 Git：选择该仓库，Publish directory 设为 `.`。
- 若手动上传：直接拖拽该文件夹内容。

## Vercel
- 安装并登录 CLI：`npm i -g vercel && vercel login`
- 在本目录运行：`vercel` 或 `vercel --prod`。

## Docker
- 构建镜像：`docker build -t fireworks-2026 .`
- 运行：`docker run -p 8080:80 fireworks-2026`
- 访问：`http://localhost:8080`
