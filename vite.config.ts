import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';
import { fileURLToPath } from 'node:url';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async () => {
  const useNitro = process.env.VERCEL === '1' || Boolean(process.env.NITRO_PRESET);
  if (useNitro) {
    const { nitro } = await import('nitro/vite');
    return {
      resolve: {
        alias: [
          {
            find: /^\.\/account-runtime$/,
            replacement: fileURLToPath(new URL('./lib/account-runtime-node.ts', import.meta.url)),
          },
          // CSS-only package exports must resolve as styles in the Node RSC build.
          { find: /^tailwindcss$/, replacement: fileURLToPath(import.meta.resolve('tailwindcss/index.css')) },
          { find: /^tw-animate-css$/, replacement: fileURLToPath(new URL('./node_modules/tw-animate-css/dist/tw-animate.css', import.meta.url)) },
          { find: /^shadcn\/tailwind\.css$/, replacement: fileURLToPath(import.meta.resolve('shadcn/tailwind.css')) },
        ],
      },
      css: { postcss: { plugins: [tailwindcss()] } },
      plugins: [vinext(), nitro()],
    };
  }

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
