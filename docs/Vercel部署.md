# Vercel 部署

本项目使用 vinext。Vercel 构建由 Nitro 适配，生成 `.vercel/output` 中的函数、静态资源和路由配置。项目配置已写入根目录 `vercel.json`，连接 GitHub 后提交会触发部署。

## 构建设置

- Root Directory 使用仓库根目录。
- Framework Preset 为 Other，由 `vercel.json` 中的 `framework: null` 指定。
- Build Command 为 `npm run build:vercel`。
- Output Directory 使用默认值，Nitro 生成的 Build Output API 配置会提供函数与静态资源路径。

原本的 `npm run dev` 和 `npm run build` 继续用于本地 Cloudflare 环境。

## 账号与数据库

账号需要持久保存。Vercel 的 Node 函数通过 Cloudflare D1 HTTP API 使用与本地相同的账号表结构。

1. 在 Cloudflare 中选择已有 D1 数据库，或创建用于本项目账号的 D1 数据库，取得 Account ID 和 Database ID。
2. 创建可读写该账号下 D1 数据库的 API Token，权限为 Account / D1 / Edit，并限制到所用 Cloudflare 账号。
3. 在 Vercel 项目的 Settings → Environment Variables 中填写下表，应用到需要运行的 Production 或 Preview 环境。
4. 保存后重新部署。账号服务会创建所需表及初始超级管理员。

| 变量 | 用途 |
| --- | --- |
| `ADMIN_USERNAME` | 管理员登录别名，使用 `admin` 即可 |
| `ADMIN_PASSWORD_HASH` | 管理员初始密码哈希，可沿用本地 `.dev.vars` 中同名配置 |
| `ADMIN_SESSION_SECRET` | 登录会话签名密钥，可沿用本地 `.dev.vars` 中同名配置 |
| `CLOUDFLARE_ACCOUNT_ID` | D1 所属 Cloudflare 账号 ID |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 数据库 ID |
| `CLOUDFLARE_D1_API_TOKEN` | 服务端调用 D1 API 的 Token |

这些配置放在 Vercel 环境变量中，不加 `VITE_` 或 `NEXT_PUBLIC_` 前缀。初始密码只在创建超级管理员时使用；已有账号的密码、角色和会话版本以数据库为准。

本地 Wrangler 模拟数据库保存在本机。使用新建的远程 D1 数据库时，会初始化独立的管理员账号；本机已有其他用户记录需要单独迁移。

## 验证

- `/login` 显示登录页面，匿名访问 `/` 或业务页面跳转至登录。
- 缺少账号或数据库配置时，登录接口返回 503 和“账号服务尚未准备好”的提示。
- 正确配置后，检查登录、新增用户、角色权限、修改密码和退出登录。
- 本地执行 `npm run build:vercel` 验证 Vercel 产物，执行 `node tests/d1-http-runtime.test.mjs` 检查数据库适配与账号行为。

实现依据：[vinext 多平台部署](https://github.com/cloudflare/vinext#other-platforms-via-nitro)、[Nitro Vercel 适配](https://nitro.build/deploy/providers/vercel)、[Cloudflare D1 Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)。
