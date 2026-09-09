import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '丰宾电子 · 智能体工作台',
  description:
    '客户推荐、设备维修、能源预测、生产洞察与供应商评估，五大智能工厂场景 POC。',
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
