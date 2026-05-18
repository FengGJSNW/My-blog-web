import type { SiteConfig } from "@/types/config";
import { fontConfig } from "./fontConfig";

// 定义站点诨
// 诨代码，例如：'zh_CN', 'zh_TW', 'en', 'ja', 'ru'?
const SITE_LANG = "zh_CN";

export const siteConfig: SiteConfig = {
	// 站点标
	title: "Feng_GJSNW",

	// 站点剠?
	subtitle: "blog",

	// 站点 URL
	site_url: "https://fenggjsnw.top",

	// Site description
	description: "",

	// Site keywords
	keywords: [
		"Firefly",
		"Astro",
		"ACGN",
		"",
		"",
		"̬",
		"linux",
		"c++",
		"c",
		"cuda",
		"python",
		"java",
	],

	// 主?
	themeColor: {
		// 主色的默色相，范围从 0 ?360。例如：红色?，青色：200，蓝绿色?50，粉色：345
		hue: 165,
		// 昐对闅隐藏主题色选择?
		fixed: false,
		// 默模式?light" 争?dark" 暗色?system" 跟随系统
		defaultMode: "system",
	},

	// 页面整体宽度（单位：rem?
	// 数越大可以页面内区域更
	// 在使用单侧栏边栏时，建调低些度以获得更好的觉效果?
	pageWidth: 100,

	// 网站Card样式配置
	card: {
		// 昐名片边框和阴影，开吐让网站更有立体感
		border: true,
		// 昐让卡片格跟随主题色?
		followTheme: false,
	},

	// Favicon 配置
	favicon: [
		{
			// 图标文件跾
			src: "/assets/images/favicon.ico?v=20260106",
			// 叉，指定主 'light' | 'dark'
			// theme: "light",
			// 叉，图标大小
			// sizes: "32x32",
		},
	],

	// 导航栏配?
	navbar: {
		// 导航栏Logo
		// 攌三类型?
		// 1. Astro图标? { type: "icon", value: "material-symbols:home-pin-outline" }
		// 2. 朜图片（public盽，不优化? { type: "image", value: "/assets/images/logo.webp", alt: "Logo" }
		// 3. 朜图片（src盽，自动优化但会加构建时间，推荐? { type: "image", value: "assets/images/logo.webp", alt: "Logo" }
		// 4. 网络图片: { type: "url", value: "https://example.com/logo.png", alt: "Logo" }
		logo: {
			type: "image",
			value: "/assets/images/meow.png?v=20260106",
			alt: "🍀",
		},
		// 导航栏标?
		title: "Feng_GJSNW",
		// 全导航栏，导航栏是否占满屏幕?
		widthFull: false,
		// 导航菜单对齐方式，left：左对齐，center：居?
		menuAlign: "center",
		// 导航栏图标和标昐跟随主?
		followTheme: false,
		// 导航栏是否固定在顶部并终可?
		stickyNavbar: true,
	},

	// 站点始日期，用于统运天数
	siteStartDate: "2026-01-01",

	// 站点时区（IANA 时区字串），用于格式化bangumi、rss里的构建日期时间等等..
	// 示例?Asia/Shanghai", "UTC", 如果为空，则按照构建服务器的时区进时区轍
	timezone: "Asia/Shanghai",

	// 提醒框（Admonitions）配罼俔后需要重吼发服务器才能生效
	// 主?github' | 'obsidian' | 'vitepress'，每丸题格和诳不同，可根据喜好选择
	rehypeCallouts: {
		theme: "github",
	},

	// 文章页底部的"上编辑时间"卡片?
	showLastModified: true,

	// 文章过期阈（天数），超过此天数才显示"上编辑"卡片
	outdatedThreshold: 30,

	// 昐合亵报生成功?
	sharePoster: true,

	// OpenGraph图片功能,注意吐要渲染很长时间，不建讜地调试的时开?
	generateOgImages: false,

	// bangumi配置
	bangumi: {
		// Bangumi用户ID
		userId: "100000000",
		// 条目类型排序，数组中的类型将按顺序优先展?
		// 叉? "anime" | "book" | "music" | "game" | "real" (暂不攌"real"类型)
		// 月出的类型将按默顺序排在后面
		categoryOrder: ["anime", "book", "music", "game"],
	},

	// 页面关配?- 控制特定页面的闝限，设为false会返?04
	// bangumi的数捸编译时获取的，所以不昮时数捼请配置bangumi.userId
	pages: {
		// 友链页面?
		friends: true,
		// 赞助页面?
		sponsor: true,
		// 留言板页面开关，要配罯论系?
		guestbook: true,
		// 畻计划页面关，吿畁游戏书籍和音乐，dev调试时只获取页数捼build才会获取全部数据
		bangumi: true,
		// 相册页面?
		gallery: true,
	},

	// 分类导航栏开关，在页和归档页顶部显示分类快捷?
	categoryBar: true,

	// 文章列表布局配置
	postListLayout: {
		// 默布局模式?list" 列表模式（单列布），"grid" 网格模式（列布?
		defaultMode: "list",
		// 移动竻认布模式，不设置则跟?defaultMode
		mobileDefaultMode: "list",
		// 昐在文章列表中显示标
		showTags: true,
		// 文章介显示数，设为 0 则不或
		descriptionLines: 2,
		// 昐允用户切换布局
		allowSwitch: true,
		// 网格布局配置，仅?defaultMode ?"grid" 或允许切换布时生?
		grid: {
			// 昐向布流布，同时有封面图和无封面图的混合文章推荐开?
			masonry: false,
			// 网格模式卡片小?px)，浏览器根据容器宽度臊计算列数
			columnWidth: 320,
		},
	},

	// 分页配置
	pagination: {
		// 每页显示的文章数?
		postsPerPage: 10,
	},

	// 统分析
	analytics: {
		// Google Analytics ID
		googleAnalyticsId: "",
		// Microsoft Clarity ID
		microsoftClarityId: "",
		// Umami 统配置
		umamiAnalytics: {
			// Umami Website ID
			websiteId: "",
			// Umami JS地址，支持使用自?
			scriptUrl: "https://cloud.umami.is/script.js",
			// 昐追踪出站链接
			trackOutboundLinks: true,
			// 昐收集浏器能指标
			collectWebVitals: false,
			// 会话回放配置
			relpays: {
				// 昐吔会话回放
				enabled: false,
				// 录制会话采样率，范围 0-1，例?0.15 表示记录 15% 的会?
				sampleRate: 0.15,
				// 隐遽级别?moderate" 会遮罩所有输入?strict" 额遽页面全部文本
				maskLevel: "moderate",
				// 单录制大时长（?
				maxDuration: 300000,
				// 要排除录制的元素 CSS 选择噼例 ".sensitive-widget"
				blockSelector: "",
			},
		},
		// 51la 统配置
		la51Analytics: {
			// 51la 统 ID
			Id: "",
			// 臮?SDK JS 地址，防?DNS 污染，留空使用默认地
			sdkUrl: "",
			// 多个统 ID 的数捈离标识，留空则使?Id
			ck: "",
			// 昐吺件分析功?
			autoTrack: false,
			//  Hash跔模式, 项目使用History API跔, 以不必开吻alse
			hashMode: false,
			// 昐吽站录屏功?
			screenRecord: true,
		},
	},

	// 图像优化及响应式配置
	// 图像优化压缩叿留avif或webp
	// 响应式图像是为在不同设上提高能而调整的图像。这些图像可以调整大小以适应其噼并且叻根据访问者的屏幕尺和分辨率以不同的大小提供?
	// Astro 仅能?src 盽下的图像进优化，src 盽下的图像越，构建时间会越长
	// Astro 图像文档 https://docs.astro.build/zh-cn/guides/images/
	imageOptimization: {
		// 输出图片格式
		// - "avif": 仅输?AVIF 格式（最新技朼小体秼盉兼性较低）
		// - "webp": 仅输?WebP 格式（体秂中，兼容好?
		// - "both": 同时输出 AVIF ?WebP（推荐，浏器自动择佳格式）
		formats: "webp",
		// 图片压缩质量 (1-100)，越低体秶小但质量越差，推?70-85
		quality: 85,
		// 为特定域名的图片添加 referrerpolicy="no-referrer" 属?
		// 攌通配?*，例如：["i0.hdslb.com", "*.bilibili.com"]
		// 叧决指定域名图片加载时?403 （防盗链图片）
		noReferrerDomains: [],
	},

	// 字体配置
	// 在src/config/fontConfig.ts丅罅体字?
	font: fontConfig,

	// 站点诨，在朅罖件顶部SITE_LANG定义
	lang: SITE_LANG,
};
