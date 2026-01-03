# Fireworks 2026 Deploy

## GitHub Pages
- 初始化 Git 仓库并推送到 GitHub：
  - `git init`
  - `git add . && git commit -m "init fireworks"`
  - 创建远程仓库后：`git remote add origin <your_repo_url>`
  - `git branch -M main && git push -u origin main`
- 在仓库 Settings → Pages 中选择 Source: GitHub Actions。
- 工作流位于 `.github/workflows/deploy.yml`，推送到 `main` 或 `fireworks-2026` 后自动部署。

## Netlify
- 登录 Netlify，选择 "Add new site" → "Deploy manually" 或 "Import from Git"。
- 若走 Git：选择该仓库，Publish directory 设为 `.`。
- 若手动上传：直接拖拽该文件夹内容。

## Vercel
- 安装并登录 CLI：`npm i -g vercel && vercel login`
- 在本目录运行：`vercel` 或 `vercel --prod`。
- 或使用网页导入：`https://vercel.com/new/import?s=<你的Git仓库URL>`，Root Directory 选 `fireworks-2026`。
- 成功后会得到形如 `https://fireworks-2026-<hash>.vercel.app/` 的公网地址。

## Cloudflare Pages（CLI 方式）
- 安装 Wrangler：`npm i -g wrangler`
- 登录：`wrangler login`
- 发布：`wrangler pages publish . --project-name fireworks-2026`
- 已提供配置：[wrangler.toml](./wrangler.toml)
- 成功后会得到形如 `https://fireworks-2026.pages.dev/` 的公网地址。

## Fly.io（Docker 方式）
- 安装并登录：`flyctl auth signup && flyctl auth login`
- 初始化应用：`flyctl apps create fireworks-2026`
- 部署：`flyctl launch --no-deploy && flyctl deploy`
- 已提供配置：[fly.toml](./fly.toml) 与 [Dockerfile](./Dockerfile)
- 部署成功后会得到形如 `https://fireworks-2026.fly.dev/` 的公网地址。

## Docker
- 构建镜像：`docker build -t fireworks-2026 .`
- 运行：`docker run -p 8080:80 fireworks-2026`
- 访问：`http://localhost:8080`
