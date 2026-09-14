# Vercel 部署

本项目使用 vinext。Vercel 构建由 Nitro 适配，生成 `.vercel/output` 中的函数、静态资源和路由配置。项目配置已写入根目录 `vercel.json`，连接 GitHub 后提交会触发部署。

## 构建设置

- Root Directory 使用仓库根目录。
- Framework Preset 为 Other，由 `vercel.json` 中的 `framework: null` 指定。
- Build Command 为 `npm run build:vercel`。
- Output Directory 使用默认值，Nitro 生成的 Build Output API 配置会提供函数与静态资源路径。

原本的 `npm run dev` 和 `npm run build` 继续用于本地 Cloudflare 环境。

## 账号与数据库

账号保存在远程数据库中。Vercel 可通过 Marketplace 接入 Turso，沿用本地 SQLite 账号表结构。账号服务会自动创建表及初始超级管理员。

### 使用 Turso

1. 在 Vercel 项目的 Storage 中选择 Turso Cloud，创建并连接账号数据库，选择 Starter 免费计划。
2. 首次安装时，由账号所有者在 Vercel 页面确认服务条款。将数据库连接到 Production 环境。
3. 集成会自动注入 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。在 Settings → Environment Variables 中补充下表中的三个管理员变量。
4. 重新部署，验证管理员登录和用户管理。

| 变量 | 用途 |
| --- | --- |
| `ADMIN_USERNAME` | 管理员登录别名，使用 `admin` 即可 |
| `ADMIN_PASSWORD_HASH` | 管理员初始密码哈希，可沿用本地 `.dev.vars` 中同名配置 |
| `ADMIN_SESSION_SECRET` | 生产环境独立的随机会话签名密钥，至少 43 个字符 |

CLI 也可以创建并连接数据库。从已链接的项目目录执行：

```bash
vercel integration add tursocloud --name fengbin-accounts --plan starter --metadata region=iad1 --environment production --no-env-pull
```

数据库区域应尽量靠近 Vercel 服务端函数区域。`--no-env-pull` 保留远程环境变量注入，不将数据库凭证下载到本地。首次条款确认按照 CLI 返回的官方页面操作；确认后继续创建资源。

### 使用已有 Cloudflare D1

如果已有 D1 数据库，可以沿用服务端 D1 HTTP API。除三个管理员变量外，再配置：

| 变量 | 用途 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | D1 所属 Cloudflare 账号 ID |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 数据库 ID |
| `CLOUDFLARE_D1_API_TOKEN` | 服务端调用 D1 API 的 Token |

Token 需要对应账号的 Account / D1 / Edit 权限。Vercel 中配置了 Turso 变量时使用 Turso，否则使用 D1。Turso 配置不完整会返回服务未就绪，不会自动切换到其他账号库。

这些配置放在 Vercel 环境变量中，不加 `VITE_` 或 `NEXT_PUBLIC_` 前缀。初始密码只在创建超级管理员时使用；已有账号的密码、角色和会话版本以数据库为准。

本地 Wrangler 模拟数据库保存在本机。使用新建的远程数据库时，会初始化独立的管理员账号；本机已有其他用户记录需要单独迁移。

## 验证

- `/login` 显示登录页面，匿名访问 `/` 或业务页面跳转至登录。
- 缺少账号或数据库配置时，登录接口返回 503 和“账号服务尚未准备好”的提示。
- 正确配置后，检查登录、新增用户、角色权限、修改密码和退出登录。
- 本地执行 `npm run build:vercel` 验证 Vercel 产物，执行 `node tests/libsql-runtime.test.mjs` 和 `node tests/d1-http-runtime.test.mjs` 检查数据库适配与账号行为。

实现依据：[vinext 多平台部署](https://github.com/cloudflare/vinext#other-platforms-via-nitro)、[Nitro Vercel 适配](https://nitro.build/deploy/providers/vercel)、[Vercel 集成命令](https://vercel.com/docs/cli/integration)、[Turso 集成](https://vercel.com/marketplace/tursocloud)、[Turso SDK](https://docs.turso.tech/sdk/ts/reference)、[Cloudflare D1 Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)。
