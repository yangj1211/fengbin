import type { Metadata } from 'next';
import './globals.css';
import './experience.css';
import './dashboard.css';
import './customer.css';
import './dashboard-layout.css';
import './source-preview.css';
import './accounts.css';
export const metadata: Metadata = {
  title: '丰宾电子 · 智能制造平台',
  description:
    '客户推荐、设备维修、能源预测、生产洞察与供应商评估，五个业务模块，统一查看文件与数据表。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
