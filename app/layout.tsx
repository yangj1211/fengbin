import type { Metadata } from 'next';
import './globals.css';
import './experience.css';
export const metadata: Metadata = {
  title: '丰宾电子 · 智能制造平台',
  description:
    '客户推荐、设备维修、能源预测、生产洞察与供应商评估，五个业务模块，统一管理分析与工作记录。',
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
