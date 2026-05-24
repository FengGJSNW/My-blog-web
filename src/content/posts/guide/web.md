---
title: 博客搭建
published: 2026-05-12
description: 分享个人博客搭建过程与心得
tags: [博客搭建, Astro, Vercel, GitHub]
category: 索引
draft: false
---

这篇文章主要记录一下我搭建个人博客时用到的网站、工具，以及大致的搭建流程。

整个过程并不算特别复杂，大致可以理解为：

> 选择博客模板 → 本地修改 → 上传到 GitHub → 使用 Vercel 部署 → 绑定自己的域名

## 用到的网站和工具

### Astro

> 网站：[Astro Blog 模板](https://astro.build/themes/)

Astro 提供了很多现成的博客模板，可以直接选择一个自己喜欢的样式作为起点。

这里是我本人拉取的模版 ：[流萤，清新美观的 Astro 静态博客主题模板](https://github.com/CuteLeaf/Firefly?tab=readme-ov-file)

### GitHub

> 网站：[GitHub](https://github.com/)

GitHub 用来存放博客项目的源码。

Vercel 可以连接 GitHub 仓库，当你把博客代码推送到 GitHub 后，Vercel 会自动检测更新并重新部署网站。

### Vercel

> 网站：[Vercel](https://vercel.com/)

Vercel 用来部署博客，也就是把本地写好的网站公开到互联网上。

对于 Astro 这类静态博客来说，Vercel 的部署体验非常方便。一般只需要导入 GitHub 仓库，选择项目，然后按照默认配置部署即可。

### Porkbun(可选)

> 网站：[Porkbun](https://porkbun.com/)

Vercel 会默认提供一个域名，但是通常很不好记忆。所以你可以尝试购买一个域名来完成你网站的部署。

购买域名后，需要在 Vercel 中添加自定义域名，然后根据 Vercel 提供的提示，在域名商后台配置 DNS 记录。

### 本地需要准备的工具(务必安装好)

搭建博客前，建议先准备好这些工具：

- [Git](https://git-scm.com/install/) — 用于版本控制和同步代码到 GitHub  
- [VSCode](https://code.visualstudio.com/) — 代码编辑和调试工具  
- [Node.js](https://nodejs.org/zh-cn) — JavaScript 运行环境，用于运行博客项目  
- pnpm — 高效包管理工具，通过 Node.js 安装：`npm install -g pnpm`

构建正式版本，用来检查项目是否可以正常打包。

## 第一步：选择 Astro 博客模板

首先进入 Astro 的模板网站：

[Astro Blog 模板](https://astro.build/themes/)

选择一个自己喜欢的博客模板。

模板页面会提供 GitHub 仓库地址，也可能会提供一键部署按钮。对于刚开始搭建博客的人来说，可以先把模板项目下载到本地，再慢慢修改。

如果模板提供了 GitHub 仓库，可以使用下面的方式克隆项目：

```bash
git clone 仓库地址
```

进入项目根目录后，安装依赖：

```bash
pnpm install
```

然后启动本地预览：

```bash
pnpm dev
```

正常情况下，终端会显示一个本地地址，例如：

```bash
http://localhost:4321
```

使用浏览器打开这个地址，就可以在浏览器中看到博客的效果。

## 第二步：本地修改博客内容

模板下载下来之后，就可以开始修改成自己喜欢的样子。

通常可以修改的内容包括：

- 博客标题
- 个人简介
- 首页文案
- 导航栏
- 文章分类
- 标签
- 头像
- 网站图标
- 主题颜色
- 页面布局

以 Firefly 博客为例，可编辑的配置文件及位置如下：

```bash
src/
├── config/
│   ├── index.ts                # 配置索引文件
│   ├── siteConfig.ts           # 站点基础配置（标题、语言、SEO等）
│   ├── backgroundWallpaper.ts  # 背景壁纸配置
│   ├── profileConfig.ts        # 用户资料配置（头像、简介、社交链接）
│   ├── commentConfig.ts        # 评论系统配置
│   ├── announcementConfig.ts   # 公告配置
│   ├── licenseConfig.ts        # 许可证配置
│   ├── footerConfig.ts         # 页脚配置
│   ├── FooterConfig.html       # 页脚 HTML 内容
│   ├── expressiveCodeConfig.ts # 代码高亮配置
│   ├── effectsConfig.ts        # 动画特效（樱花、特效粒子等）
│   ├── fontConfig.ts           # 字体配置
│   ├── sidebarConfig.ts        # 侧边栏布局配置
│   ├── navBarConfig.ts         # 导航栏配置
│   ├── musicConfig.ts          # 音乐播放器配置
│   ├── pioConfig.ts            # 看板娘配置
│   ├── adConfig.ts             # 广告配置
│   ├── friendsConfig.ts        # 友链配置
│   ├── galleryConfig.ts        # 相册配置
│   ├── sponsorConfig.ts        # 赞助配置
│   └── coverImageConfig.ts     # 文章封面图配置
```

要添加文章，需要在 `src/content/` 下新建 Markdown 文件或文件夹区分不同类别。**注意**：

- 不要放入 ZIP 或其他二进制文件，否则解析失败会报错。
- 文件夹结构可自由创建，但请保证 Markdown 文件后缀为 `.md` 或 `.mdx`。

每篇文章的 Frontmatter 示例：

```yaml
---
title: My First Blog Post
published: 2023-09-09
description: This is the first post of my new Astro blog.
image: ./cover.jpg      # 或使用 "api" 启用随机封面图
tags: [Foo, Bar]
category: Front-end
draft: false
lang: zh-CN            # 当文章语言与 siteConfig.ts 的默认语言不同时设置
pinned: false           # 是否置顶
comment: true           # 是否允许评论
---
```

写文章建议统一使用 [Markdown 语法](https://markdown.com.cn/basic-syntax/)。  
Markdown 会解析绝大部分网页内容，如果需要特殊 HTML/JS/TSX，可以嵌入模板语法或组件，但请确保语法正确，以免渲染错误。

建议将网站中所有静态资源集中管理，放入 `public` 文件夹，以便在博客中引用：

- **图片**：头像、封面、文章配图、装饰性图标等。
- **可下载文件**：如果你希望在博客中提供代码、ZIP 压缩包、PDF 等下载资源，请统一放在 `public` 文件夹下。
- **音乐**：用于音乐播放器或背景音乐的音频文件。
- **其他静态资源**：如 favicon、Logo、主题自定义图片等。

Firefly 默认模板的一些静态资源也在 `public` 文件夹中，你可以直接修改这些资源来个性化自己的网站，例如：

```
public/
├── images/           # 网站默认图片，可替换或新增
├── audio/            # 音乐文件
└── downloads/        # 可下载文件
```

💡 **注意事项**：

1. 所有文件路径应保持一致，文章或页面中引用路径为 `/images/...`、`/audio/...`、`/downloads/...` 等。
2. 不要在 `src/` 文件夹中直接放置二进制文件（如 ZIP、音频等），否则可能被错误解析或构建报错。
3. 通过 `public` 文件夹管理静态资源，可以让部署后的博客直接访问这些文件，无需额外配置。

## 第三步：同步到 GitHub

在本地完成博客修改后，需要将项目上传到 GitHub，以便 Vercel 或其他平台可以自动部署。

### 1. 创建 GitHub 仓库
先在 GitHub 上新建一个仓库（Repository），记下仓库的 HTTPS 或 SSH 地址。

### 2. 初始化本地仓库并提交代码
进入博客项目目录，执行以下命令：

```bash
git init                      # 初始化本地 Git 仓库
git add .                      # 添加所有文件到暂存区
git commit -m "init blog"      # 提交代码
git branch -M main             # 设置主分支为 main
git remote add origin <仓库地址> # 添加远程仓库地址
git push -u origin main        # 推送到 GitHub
```

### 3. 查看远程仓库地址
确认远程仓库地址是否正确：

```bash
git remote -v
```

### 4. 修改远程仓库地址（可选）
如果需要更改远程仓库地址，可以使用：

```bash
git remote set-url origin <新的仓库地址>
```

然后再次推送：

```bash
git push -u origin main
```

### 5. 说明
- 每次本地修改完博客内容后，都需要执行 `git add .` → `git commit -m "说明"` → `git push`，以同步到 GitHub。
- Git 命令的详细含义和使用方法可以参考我的笔记：[Git 笔记](http://fenggjsnw.top/posts/tech/git/)

## 第四步：使用 Vercel 部署

打开 Vercel 后，选择导入 GitHub 仓库。

一般流程是：

1. 登录 Vercel
2. 连接 GitHub 账号
3. 选择博客所在的仓库
4. 导入项目
5. 确认构建命令和输出目录
6. 点击部署

对于 Astro 项目，常见配置一般是：

```bash
Build Command: pnpm build
Output Directory: dist
```

大部分情况下，Vercel 会自动识别项目类型，不需要手动修改太多配置。

部署完成后，Vercel 会给你一个默认域名，例如：

```bash
xxx.vercel.app
```

这时你的博客就已经可以公开访问了。

## 第五步：购买并绑定自己的域名

如果想让博客看起来更正式，可以购买一个自己的域名。

购买域名后，需要做两件事：

第一，在 Vercel 中添加自定义域名。

进入项目设置，找到 Domains，然后添加自己的域名。

第二，在域名商后台配置 DNS。

Vercel 会告诉你需要添加哪些 DNS 记录。

按照 Vercel 的提示添加即可。

DNS 配置完成后，可能不会立刻生效，需要等待一段时间。短则几分钟，长则可能需要数小时。

💡 **注意事项**：

1. 每次更新你的Blog的时候，同样也不会立刻生效，但是一般都会在10分钟内都会构建好。

## 第六步：访问你的博客

当 Vercel 部署成功，并且域名解析生效后，就可以通过自己的域名访问博客了。

之后写博客的大致流程就是：

1. 在本地新建或修改 Markdown 文章
2. 使用 `pnpm dev` 本地预览
3. 确认没问题后提交到 GitHub
4. Vercel 自动重新部署
5. 访问网站查看更新结果

推送完成后，Vercel 会自动开始部署。

## 一些踩坑记录

### 1. 切记不要乱发文件到 `src/` 或项目根目录

> ⚠️⚠️⚠️再次提醒，这是我踩得最大的坑

- 所有静态资源（图片、音乐、可下载文件如 ZIP、PDF 等）请统一放到 `public/` 文件夹。
- `src/` 目录主要存放源码、文章 Markdown 文件和组件，如果放入二进制文件，可能会导致构建报错或被错误解析。
- 保持目录结构整洁，有利于部署和后期维护，同时避免意外覆盖或泄露敏感文件。

## 总结

这次博客搭建让我大致理解了一个现代静态博客的基本流程。

Astro 负责生成博客页面，GitHub 负责保存代码，Vercel 负责自动部署，域名则负责让网站拥有一个更正式的访问地址。

搭建过程本身并不难，真正需要花时间的地方，反而是后续如何调整博客样式、整理文章结构，以及持续写内容。

最后，感谢 [今朝酒](https://www.kesazake.top/) 鼎力相助助我完成了网站构建