export const languages = {
  en: 'English',
  zh: '中文'
} as const

export type Lang = keyof typeof languages

export const defaultLang: Lang = 'en'

export const translations = {
  en: {
    // Site
    'site.title': "Jimdeng's Blog",
    'site.description': 'Backend Dev / Agent Dev',
    // Nav
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.series': 'Series',
    'nav.docs': 'Docs',
    'nav.projects': 'Projects',
    'nav.links': 'Links',
    'nav.about': 'About',
    'nav.search': 'Search',
    'nav.gallery': 'Gallery',
    'nav.whispers': 'Moments',
    // Whispers (moments)
    'whispers.title': 'Moments',
    'whispers.description': 'Fragments of time, captured as they happen.',
    'whispers.empty': 'No moments yet.',
    'whispers.unavailable': 'Moments are temporarily unavailable.',
    'whispers.older': 'Older',
    'whispers.newer': 'Newer',
    'whispers.tags': 'Tags',
    'whispers.tags_desc': 'All topics used in moments',
    'whispers.view_all_tags': 'View all tags →',
    // Gallery
    'gallery.title': 'Gallery',
    'gallery.subtitle': 'Capturing the beautiful moments in life',
    'gallery.all': 'All',
    'gallery.empty': 'No albums yet.',
    'gallery.back': 'Back to gallery',
    'gallery.photos': 'photos',
    // Home
    'home.about': 'About',
    'home.about.desc':
      'Backend engineer / AI application developer. Passionate about building high-performance systems and exploring AI applications in real-world scenarios.',
    'home.more_about': 'More about me',
    'home.posts': 'Blog',
    'home.more_posts': 'More posts',
    'home.whispers': 'Moments',
    'home.more_whispers': 'More moments',
    'home.skills': 'Skills',
    'home.location': 'Beijing, China',
    // Blog
    'blog.title': 'Blog',
    'blog.description': 'Posts and archives of my blog',
    'blog.page': 'Page',
    'blog.showing': 'Showing',
    'blog.of': 'of',
    'blog.posts': 'posts',
    'blog.view_all': 'View all posts by years →',
    'blog.tags': 'Tags',
    'blog.view_all_tags': 'View all →',
    'blog.no_posts': 'No posts yet.',
    'blog.prev': '← Previous Posts',
    'blog.next': 'Next Posts →',
    // Series
    'series.title': 'Series',
    'series.description': 'Article series organized by topic',
    'series.posts': 'articles',
    'series.no_series': 'No series yet.',
    'series.no_posts': 'No posts in this series yet.',
    // About
    'about.title': 'About',
    'about.intro': 'Backend engineer / AI application developer',
    'about.desc':
      'I am an engineer focused on backend technology and AI application development, passionate about building high-performance, highly available system architectures, while actively exploring the practical application of AI.',
    'about.me': 'About Me',
    'about.find_me': 'Find Me',
    'about.blog_label': 'Blog',
    'about.email_label': 'Email',
    'about.about_blog': 'About Blog',
    'about.history': 'Website history:',
    'about.tech_stack': 'Tech stack:',
    // About hero
    'hero.eyebrow': "HELLO, I'M JIM DENG",
    'hero.title1': 'Exploring in code,',
    'hero.title2': 'growing in ',
    'hero.title2_accent': 'life.',
    'hero.desc1': 'Backend engineer and explorer of AI applications.',
    'hero.desc2': 'Turning ideas into code, and everyday moments into stories.',
    'hero.cta_posts': 'Read my posts',
    'hero.cta_projects': 'See my projects',
    'hero.note': 'Stay curious, grow slowly.',
    'hero.play': 'Play',
    'hero.pause': 'Pause',
    'hero.play_aria': 'Play scene animation',
    'hero.pause_aria': 'Pause scene animation',
    // Common
    'common.back': 'Back',
    // Language switcher
    'lang.switch': 'Switch language'
  },
  zh: {
    // Site
    'site.title': 'Jimdeng 的博客',
    'site.description': '后端开发 / Agent 开发',
    // Nav
    'nav.home': '主页',
    'nav.blog': '博客',
    'nav.series': '系列',
    'nav.docs': '文档',
    'nav.projects': '项目',
    'nav.links': '友链',
    'nav.about': '关于',
    'nav.search': '搜索',
    'nav.gallery': '相册',
    'nav.whispers': '时光',
    // Whispers (moments)
    'whispers.title': '时光',
    'whispers.description': '来自 memos 的时光碎片，随手记录的日常。',
    'whispers.empty': '暂无记录。',
    'whispers.unavailable': '时光暂时不可用，请稍后再试。',
    'whispers.older': '较旧',
    'whispers.newer': '较新',
    'whispers.tags': '标签',
    'whispers.tags_desc': '时光中用到的全部话题',
    'whispers.view_all_tags': '查看全部标签 →',
    // Gallery
    'gallery.title': '相册',
    'gallery.subtitle': '记录生活中的美好瞬间',
    'gallery.all': '全部',
    'gallery.empty': '暂无相册。',
    'gallery.back': '返回相册',
    'gallery.photos': '张照片',
    // Home
    'home.about': '关于',
    'home.about.desc':
      '后端工程师 / AI 应用从业者。专注于构建高性能、高可用的系统架构，同时积极探索人工智能在实际场景中的落地应用。',
    'home.more_about': '了解更多',
    'home.posts': '博客',
    'home.more_posts': '更多文章',
    'home.whispers': '碎碎念',
    'home.more_whispers': '更多碎碎念',
    'home.skills': '技能',
    'home.location': '中国 北京',
    // Blog
    'blog.title': '博客',
    'blog.description': '博客文章与归档',
    'blog.page': '第',
    'blog.showing': '显示',
    'blog.of': '共',
    'blog.posts': '篇文章',
    'blog.view_all': '按年份查看所有文章 →',
    'blog.tags': '标签',
    'blog.view_all_tags': '查看全部 →',
    'blog.no_posts': '暂无文章。',
    'blog.prev': '← 上一页',
    'blog.next': '下一页 →',
    // Series
    'series.title': '系列',
    'series.description': '按主题组织的系列文章',
    'series.posts': '篇文章',
    'series.no_series': '暂无系列。',
    'series.no_posts': '该系列暂无文章。',
    // About
    'about.title': '关于',
    'about.intro': '后端工程师 / AI 应用从业者',
    'about.desc':
      '我是一名专注于后端技术和 AI 应用开发的工程师，热衷于构建高性能、高可用的系统架构，同时积极探索人工智能在实际场景中的落地应用。',
    'about.me': '关于我',
    'about.find_me': '找到我',
    'about.blog_label': '个人博客',
    'about.email_label': '邮箱',
    'about.about_blog': '关于博客',
    'about.history': '网站历程：',
    'about.tech_stack': '本站技术栈：',
    // About hero
    'hero.eyebrow': "HELLO, I'M JIM DENG",
    'hero.title1': '在代码里探索，',
    'hero.title2': '在生活里',
    'hero.title2_accent': '生长。',
    'hero.desc1': '后端工程师，也是 AI 应用的探索者。',
    'hero.desc2': '把想法写成代码，把日常收藏成故事。',
    'hero.cta_posts': '阅读我的文章',
    'hero.cta_projects': '看看我的项目',
    'hero.note': '保持好奇，慢慢生长。',
    'hero.play': '播放动画',
    'hero.pause': '暂停动画',
    'hero.play_aria': '播放场景动画',
    'hero.pause_aria': '暂停场景动画',
    // Common
    'common.back': '返回',
    // Language switcher
    'lang.switch': '切换语言'
  }
} as const
