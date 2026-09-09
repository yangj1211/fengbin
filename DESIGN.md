# 丰宾电子 POC design

## Scene and direction
客户业务负责人坐在明亮会议室，演示者用笔记本与投屏讲解五个智能体。白色内容页与石墨色导航提供稳固层级；铜橙仅用于当前场景和主要动作。

## Color strategy
Restrained. Pure white background, neutral secondary surface, graphite navigation, copper-orange primary.
- Background: oklch(1 0 0)
- Surface: oklch(.975 0 0)
- Ink: oklch(.25 .008 60)
- Muted: oklch(.49 .008 60)
- Primary: oklch(.54 .135 55)
- Sidebar: oklch(.22 .006 60)
- Positive: oklch(.42 .09 160)

## Typography
System sans with PingFang SC / Microsoft YaHei. Main copy 16px, labels 14px, metadata 12px. Fixed heading sizes 24px and 30px.

## Layout
240px persistent sidebar, compact 68px top bar, main work area with scenario context, an editable demo request, and a result workspace. Secondary scenario context is a quiet right rail. Below 1100px the right rail stacks; below 768px navigation becomes a sheet.

## Controls
Use provided sidebar, tabs, button, textarea, table and progress primitives. Corners 8–12px. Outlined surfaces, no ornamental soft shadows. Selected navigation uses neutral fill with copper icon. Motion only during simulated analysis and result replacement; reduced-motion supported.
