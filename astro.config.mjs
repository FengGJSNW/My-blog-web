import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { setMaxListeners } from "node:events";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
import { defineConfig } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeComponents from "rehype-components"; /* Render the custom directive content */
import rehypeKatex from "rehype-katex";
import katex from "katex";
import "katex/dist/contrib/mhchem.mjs"; // 加载 mhchem 扩展
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive"; /* Handle directives */
import remarkMath from "remark-math";
import rehypeCallouts from "rehype-callouts";
import remarkSectionize from "remark-sectionize";
import { expressiveCodeConfig, siteConfig } from "./src/config";
import { i18n } from "./src/i18n/translation";
import I18nKey from "./src/i18n/i18nKey";
import { pluginLanguageBadge } from "expressive-code-language-badge"; /* Language Badge */
import { pluginCollapsible } from "expressive-code-collapsible"; /* Collapsible */
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { rehypePlantuml } from "./src/plugins/rehype-plantuml.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
import { remarkPlantuml } from "./src/plugins/remark-plantuml.js";
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import rehypeEmailProtection from "./src/plugins/rehype-email-protection.mjs";
import rehypeExternalLinks from "./src/plugins/rehype-external-links.mjs";
import rehypeFigure from "./src/plugins/rehype-figure.mjs";
import rehypeResponsiveImages from "./src/plugins/rehype-responsive-images.mjs";
import { remarkFolder } from "./src/plugins/remark-folder.js";
import { remarkImageGrid } from "./src/plugins/remark-image-grid.js";
import { remarkLineDivider } from "./src/plugins/remark-line-divider.js";
import { plantumlConfig } from "./src/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

if (process.env.NODE_ENV === "development") {
	setMaxListeners(20);
}

const SVG_VIEWBOX_PADDING = 0;
const SVG_INK_FILTER_VERSION = "ink-v3";
const SVG_STROKE_WIDTH = "1.35";
const SVG_PADDING_OPEN_RE = /^<padding(?<attrs>(?:\s+[^>]*)?)>\s*$/i;
const SVG_PADDING_CLOSE_RE = /^<\/padding>\s*$/i;
const ASM_LANGUAGE_ALIASES = new Set([
	"asm",
	"assembly",
	"assembler",
	"nasm",
	"masm",
	"gas",
	"gnuasm",
	"x86asm",
	"x86-asm",
	"x86_asm",
	"x86_64",
	"x86-64",
	"armasm",
	"aarch64",
	"riscv",
	"risc-v",
]);

function expandSvgViewBox(svgContent, padding = SVG_VIEWBOX_PADDING) {
	if (padding <= 0) return svgContent;

	const svgOpenTagMatch = svgContent.match(/<svg\b[^>]*>/i);
	if (!svgOpenTagMatch) return svgContent;

	const svgOpenTag = svgOpenTagMatch[0];
	const viewBoxMatch = svgOpenTag.match(/\sviewBox=(["'])([^"']+)\1/i);

	if (viewBoxMatch) {
		const values = viewBoxMatch[2].trim().split(/[\s,]+/).map(Number);
		if (values.length === 4 && values.every(Number.isFinite)) {
			const [minX, minY, width, height] = values;
			const expandedViewBox = [
				minX - padding,
				minY - padding,
				width + padding * 2,
				height + padding * 2,
			].join(" ");

			return svgContent.replace(
				viewBoxMatch[0],
				` viewBox=${viewBoxMatch[1]}${expandedViewBox}${viewBoxMatch[1]}`,
			);
		}
	}

	const widthMatch = svgOpenTag.match(/\swidth=(["'])([\d.]+)(?:px)?\1/i);
	const heightMatch = svgOpenTag.match(/\sheight=(["'])([\d.]+)(?:px)?\1/i);

	if (!widthMatch || !heightMatch) return svgContent;

	const width = Number(widthMatch[2]);
	const height = Number(heightMatch[2]);
	if (!Number.isFinite(width) || !Number.isFinite(height)) return svgContent;

	const expandedViewBox = [
		-padding,
		-padding,
		width + padding * 2,
		height + padding * 2,
	].join(" ");

	const expandedSvgOpenTag = svgOpenTag.replace(
		/<svg\b/i,
		`<svg viewBox="${expandedViewBox}"`,
	);

	return svgContent.replace(svgOpenTag, expandedSvgOpenTag);
}

function parseSvgIntrinsicSize(svgContent) {
	const svgOpenTagMatch = svgContent.match(/<svg\b[^>]*>/i);
	if (!svgOpenTagMatch) return null;

	const svgOpenTag = svgOpenTagMatch[0];
	const widthMatch = svgOpenTag.match(/\swidth=(["'])([\d.]+)(?:px)?\1/i);
	const heightMatch = svgOpenTag.match(/\sheight=(["'])([\d.]+)(?:px)?\1/i);
	const width = widthMatch ? Number(widthMatch[2]) : NaN;
	const height = heightMatch ? Number(heightMatch[2]) : NaN;
	if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
		return {
			width: Math.ceil(width),
			height: Math.ceil(height),
		};
	}

	const viewBoxMatch = svgOpenTag.match(/\sviewBox=(["'])([^"']+)\1/i);
	if (!viewBoxMatch) return null;

	const values = viewBoxMatch[2].trim().split(/[\s,]+/).map(Number);
	if (values.length !== 4 || !values.every(Number.isFinite)) return null;

	return {
		width: Math.ceil(values[2]),
		height: Math.ceil(values[3]),
	};
}

function resolveSvgPadding(value = "") {
	const expandMatch = value.match(
		/\sexpand(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/i,
	);

	if (!expandMatch) return 4;

	const raw = expandMatch[1] ?? expandMatch[2] ?? expandMatch[3] ?? "4";
	const amountMatch = String(raw).trim().match(/^(\d+(?:\.\d+)?)(?:\s*px)?$/i);
	if (!amountMatch) return 0;

	return Number(amountMatch[1]);
}

function getSvgFilenamePadding(filePath) {
	const match = path.basename(filePath).match(/\.p(\d+(?:\.\d+)?)\.svg$/i);
	if (!match) return 0;

	const padding = Number(match[1]);
	return Number.isFinite(padding) ? padding : 0;
}

function normalizeSvgStrokeWidth(tag) {
	if (/\bstroke=(["'])none\1/i.test(tag) || /stroke\s*:\s*none\s*;?/i.test(tag)) {
		return tag;
	}

	const hasVisibleStroke =
		/\bstroke=(["'])(?!none\1)[^"']+\1/i.test(tag) ||
		/stroke\s*:\s*(?!none\b)[^;]+;?/i.test(tag);

	if (!hasVisibleStroke) return tag;

	let next = tag;
	if (/\bstroke-width=(["'])[^"']+\1/i.test(next)) {
		next = next.replace(
			/\bstroke-width=(["'])[^"']+\1/i,
			`stroke-width="${SVG_STROKE_WIDTH}"`,
		);
	} else {
		next = next.replace(/\s*\/?>$/, (ending) => ` stroke-width="${SVG_STROKE_WIDTH}"${ending}`);
	}

	if (/stroke-width\s*:/i.test(next)) {
		next = next.replace(/stroke-width\s*:\s*[^;]+;?/gi, `stroke-width: ${SVG_STROKE_WIDTH};`);
	} else if (/\sstyle=(["'])/i.test(next)) {
		next = next.replace(/\sstyle=(["'])(.*?)\1/i, (_match, quote, style) => {
			const normalizedStyle = `${style}; stroke-width: ${SVG_STROKE_WIDTH};`
				.replace(/\s*;\s*/g, "; ")
				.replace(/^\s*;\s*|\s*;\s*$/g, "");
			return ` style=${quote}${normalizedStyle}${quote}`;
		});
	}

	if (!/\bvector-effect=(["'])non-scaling-stroke\1/i.test(next)) {
		next = next.replace(/\s*\/?>$/, (ending) => ` vector-effect="non-scaling-stroke"${ending}`);
	}

	return next;
}

function normalizeSvgInk(svgContent) {
	let content = svgContent;

	// Draw.io exports use light-dark(), which makes text/strokes white in dark mode.
	// Local article diagrams should stay visually consistent on every blog theme.
	content = content
		.replace(
			/light-dark\(\s*#000000\s*,\s*#ffffff\s*\)/gi,
			"#000000",
		)
		.replace(
			/light-dark\(\s*rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)\s*,\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)\s*\)/gi,
			"#000000",
		)
		.replace(
			/light-dark\(\s*#ffffff\s*,\s*var\(--ge-dark-color,\s*#[0-9a-fA-F]{3,8}\)\s*\)/gi,
			"transparent",
		)
		.replace(
			/light-dark\(\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)\s*,\s*var\(--ge-dark-color,\s*#[0-9a-fA-F]{3,8}\)\s*\)/gi,
			"transparent",
		);

	content = content.replace(/<svg\b[^>]*>/i, (tag) => {
		let next = tag
			.replace(/background(?:-color)?\s*:\s*(?:#[fF]{3,6}|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|transparent)\s*;?/gi, "")
			.replace(/color-scheme\s*:\s*light\s+dark\s*;?/gi, "color-scheme: light;");

		if (/\sstyle=(["'])/i.test(next)) {
			next = next.replace(/\sstyle=(["'])(.*?)\1/i, (_match, quote, style) => {
				const normalizedStyle = `${style}; background: transparent; background-color: transparent; color-scheme: light;`
					.replace(/\s*;\s*/g, "; ")
					.replace(/^\s*;\s*|\s*;\s*$/g, "");
				return ` style=${quote}${normalizedStyle}${quote}`;
			});
		} else {
			next = next.replace(
				/<svg\b/i,
				'<svg style="background: transparent; background-color: transparent; color-scheme: light;"',
			);
		}

		return next;
	});

	// Remove draw.io's full-canvas white background rect.
	content = content.replace(
		/<rect\b(?=[^>]*\bwidth=(["'])100%\1)(?=[^>]*\bheight=(["'])100%\2)[^>]*\/>/gi,
		"",
	);

	content = content.replace(/<text\b[^>]*>/gi, (tag) =>
		tag
			.replace(/\sfill=(["'])(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\1/gi, ' fill="#000000"')
			.replace(/color\s*:\s*(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*;?/gi, "color: #000000;"),
	);

	content = content.replace(
		/<(path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/gi,
		(tag) =>
			normalizeSvgStrokeWidth(tag)
				.replace(/\sfill=(["'])(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\1/gi, ' fill="transparent"')
				.replace(/fill\s*:\s*(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*;?/gi, "fill: transparent;")
				.replace(/\sstroke=(["'])(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\1/gi, ' stroke="#000000"')
				.replace(/stroke\s*:\s*(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*;?/gi, "stroke: #000000;"),
	);

	content = content
		.replace(/color\s*:\s*(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*;?/gi, "color: #000000;")
		.replace(/stroke\s*:\s*(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*;?/gi, "stroke: #000000;")
		.replace(/\sstroke=(["'])(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\1/gi, ' stroke="#000000"')
		.replace(/background(?:-color)?\s*:\s*(?:#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*;?/gi, "background-color: transparent;");

	return content;
}

function remarkLocalSvgToPublic() {
	return (tree, file) => {
		const mdPath = file.history?.[0] || file.path;
		if (!mdPath) return;

		const mdDir = path.dirname(mdPath);
		const projectRoot = process.cwd();

		const outDir = path.join(projectRoot, "public", "__local_svg");
		fs.mkdirSync(outDir, { recursive: true });

		function processSvgImage(node, padding) {
			if (node.type === "image" && typeof node.url === "string") {
				const rawUrl = node.url;

				// 跳过 public / 远程 / data 图片
				if (
					rawUrl.startsWith("http://") ||
					rawUrl.startsWith("https://") ||
					rawUrl.startsWith("data:")
				) {
					return;
				}

				const cleanUrl = rawUrl.split("?")[0].split("#")[0];
				const cleanUrlLower = cleanUrl.toLowerCase();
				if (cleanUrlLower.startsWith("/__local_svg/")) {
					return;
				}

				const isSvg = cleanUrlLower.endsWith(".svg");
				const isSvgExportPngName = cleanUrlLower.endsWith(".svg.png");

				if (isSvg || isSvgExportPngName) {
					const decodedUrl = decodeURIComponent(cleanUrl);
					const requestedAbs = decodedUrl.startsWith("/")
						? path.join(projectRoot, "public", decodedUrl.replace(/^\/+/, ""))
						: path.resolve(mdDir, decodedUrl);
					const svgFallbackAbs = isSvgExportPngName
						? requestedAbs.replace(/\.png$/i, "")
						: requestedAbs;
					const drawioFallbackAbs = svgFallbackAbs.replace(/\.svg$/i, ".drawio.svg");
					const srcAbs = fs.existsSync(requestedAbs)
						? requestedAbs
						: fs.existsSync(svgFallbackAbs)
							? svgFallbackAbs
							: drawioFallbackAbs;

					if (!fs.existsSync(srcAbs)) {
						console.warn(`[remarkLocalSvgToPublic] SVG not found: ${srcAbs}`);
						return;
					}

					const effectivePadding = Math.max(
						0,
						padding - getSvgFilenamePadding(srcAbs),
					);
					const relPath = path.relative(projectRoot, srcAbs).replace(/\\/g, "/");
					const hash = crypto
						.createHash("sha256")
						.update(`${relPath}:${effectivePadding}:${SVG_INK_FILTER_VERSION}`)
						.digest("hex")
						.slice(0, 10);

					const baseName = path
						.basename(srcAbs, ".svg")
						.replace(/[^\w.-]/g, "_");

						const outName = `${baseName}.${hash}.svg`;
					const outAbs = path.join(outDir, outName);

					const svgContent = fs.readFileSync(srcAbs, "utf8");
					const outputSvg = normalizeSvgInk(
						expandSvgViewBox(svgContent, effectivePadding),
					);
					fs.writeFileSync(outAbs, outputSvg, "utf8");

					node.url = `/__local_svg/${outName}`;
					const intrinsicSize = parseSvgIntrinsicSize(outputSvg);
					if (intrinsicSize) {
						node.data = node.data || {};
						node.data.hProperties = {
							...(node.data.hProperties || {}),
							width: intrinsicSize.width,
							height: intrinsicSize.height,
						};
					}
				}
			}
		}

		function walk(node, activePadding = 0) {
			if (!node || typeof node !== "object") return;

			if (Array.isArray(node.children)) {
				const paddingStack = [];
				let currentPadding = activePadding;

				for (let index = 0; index < node.children.length; ) {
					const child = node.children[index];

					if (child.type === "html" && typeof child.value === "string") {
						const value = child.value.trim();
						const openMatch = value.match(SVG_PADDING_OPEN_RE);

						if (openMatch) {
							paddingStack.push(currentPadding);
							currentPadding = resolveSvgPadding(openMatch.groups?.attrs);
							node.children.splice(index, 1);
							continue;
						}

						if (SVG_PADDING_CLOSE_RE.test(value)) {
							currentPadding = paddingStack.pop() ?? activePadding;
							node.children.splice(index, 1);
							continue;
						}
					}

					processSvgImage(child, currentPadding);
					walk(child, currentPadding);
					index += 1;
				}
				return;
			}

			processSvgImage(node, activePadding);
		}

		walk(tree);
	};
}

function getPublicLocalSvgDimensions(src) {
	const rawSrc = String(src || "").split("#")[0].split("?")[0];
	let cleanSrc = rawSrc;
	try {
		cleanSrc = decodeURIComponent(rawSrc);
	} catch {
		// Keep the raw path when it is not valid percent-encoding.
	}
	if (!cleanSrc.startsWith("/__local_svg/")) return null;

	const absPath = path.join(process.cwd(), "public", cleanSrc.replace(/^\/+/, ""));
	if (!fs.existsSync(absPath)) return null;

	return parseSvgIntrinsicSize(fs.readFileSync(absPath, "utf8"));
}

function rehypeLocalSvgDimensions() {
	return (tree) => {
		function walk(node) {
			if (!node || typeof node !== "object") return;

			if (node.type === "element" && node.tagName === "img") {
				const properties = node.properties || {};
				const dimensions = getPublicLocalSvgDimensions(properties.src);
				if (dimensions) {
					node.properties = {
						...properties,
						width: properties.width ?? dimensions.width,
						height: properties.height ?? dimensions.height,
					};
				}
			}

			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					walk(child);
				}
			}
		}

		walk(tree);
	};
}

function remarkNormalizeCodeLanguages() {
	return (tree) => {
		function walk(node) {
			if (!node || typeof node !== "object") return;

			if (node.type === "code" && typeof node.lang === "string") {
				const normalizedLang = node.lang.trim().toLowerCase();
				if (ASM_LANGUAGE_ALIASES.has(normalizedLang)) {
					node.lang = "asm";
				}
			}

			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					walk(child);
				}
			}
		}

		walk(tree);
	};
}

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site_url,
	
	base: "/",
	trailingSlash: "always",

	// 图像优化配置
	image: {
		// 全局响应式布局
		layout: "constrained",
	},

	experimental: {
		// Rust 编译器以提升构建性能（实验性），部分平台可能会导致构建失败，可以根据需要启用或禁用
		rustCompiler: false,
		// 队列渲染以优化性能（实验性）
		queuedRendering: { enabled: true },
	},

	integrations: [
		swup({
			theme: false,
			animationClass: "transition-swup-", // see https://swup.js.org/options/#animationselector
			// the default value `transition-` cause transition delay
			// when the Tailwind class `transition-all` is used
			containers: [
				"#banner-overlay-container",
				"#banner-dim-container",
				"#swup-container",
				"#left-sidebar-dynamic",
				"#right-sidebar-dynamic",
				"#floating-toc-wrapper",
			],
			smoothScrolling: false,
			cache: true,
			preload: true,
			accessibility: true,
			updateHead: true,
			updateBodyClass: false,
			globalInstance: true,
			// 滚动相关配置优化
			resolveUrl: (url) => url,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => {
				// 跳过锚点链接的处理，让浏览器原生处理
				return event.state?.url?.includes("#");
			},
		}),
		icon({
			include: {
				"material-symbols": ["*"],
				"fa7-brands": ["*"],
				"fa7-regular": ["*"],
				"fa7-solid": ["*"],
				"simple-icons": ["*"],
				mdi: ["*"],
			},
		}),
		expressiveCode({
			themes: [expressiveCodeConfig.darkTheme, expressiveCodeConfig.lightTheme],
			useDarkModeMediaQuery: false,
			themeCssSelector: (theme) => `[data-theme='${theme.name}']`,
			plugins: [
				// pluginLanguageBadge 配置 - 从expressiveCodeConfig读取设置
				...(expressiveCodeConfig.pluginLanguageBadge?.enable === true
					? [pluginLanguageBadge()]
					: []),
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				// pluginCollapsible 配置 - 从expressiveCodeConfig读取设置，使用i18n文本
				...(expressiveCodeConfig.pluginCollapsible?.enable === true
					? [
							pluginCollapsible({
								lineThreshold:
									expressiveCodeConfig.pluginCollapsible.lineThreshold || 15,
								previewLines:
									expressiveCodeConfig.pluginCollapsible.previewLines || 8,
								defaultCollapsed:
									expressiveCodeConfig.pluginCollapsible.defaultCollapsed ??
									true,
								expandButtonText: i18n(I18nKey.codeCollapsibleShowMore),
								collapseButtonText: i18n(I18nKey.codeCollapsibleShowLess),
								expandedAnnouncement: i18n(I18nKey.codeCollapsibleExpanded),
								collapsedAnnouncement: i18n(I18nKey.codeCollapsibleCollapsed),
							}),
						]
					: []),
			],
			defaultProps: {
				wrap: false,
				overridesByLang: {
					shellsession: {
						showLineNumbers: false,
					},
				},
			},
			styleOverrides: {
				borderRadius: "0.75rem",
				codeFontSize: "0.875rem",
				codeFontFamily:
					"'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
				codeLineHeight: "1.5rem",
				frames: {},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250,
				},
				languageBadge: {
					fontSize: "0.75rem",
					fontWeight: "bold",
					borderRadius: "0.25rem",
					opacity: "1",
					borderWidth: "0px",
					borderColor: "transparent",
				},
			},
			frames: {
				showCopyToClipboardButton: true,
			},
		}),
		svelte(),
		sitemap({
			filter: (page) => {
				// 根据页面开关配置过滤sitemap
				const url = new URL(page);
				const pathname = url.pathname;

				if (pathname === "/friends/" && !siteConfig.pages.friends) {
					return false;
				}
				if (pathname === "/sponsor/" && !siteConfig.pages.sponsor) {
					return false;
				}
				if (pathname === "/guestbook/" && !siteConfig.pages.guestbook) {
					return false;
				}
				if (pathname === "/bangumi/" && !siteConfig.pages.bangumi) {
					return false;
				}
				if (pathname === "/gallery/" && !siteConfig.pages.gallery) {
					return false;
				}

				return true;
			},
		}),
		mdx(),
	],
	markdown: {
		remarkPlugins: [
			remarkMath,
			remarkNormalizeCodeLanguages,
			remarkReadingTime,
			remarkImageGrid,
			remarkExcerpt,
			remarkLocalSvgToPublic,
			remarkFolder,
			remarkLineDivider,
			remarkDirective,
			remarkSectionize,
			parseDirectiveNode,
			remarkMermaid,
			[remarkPlantuml, plantumlConfig],
		],
		rehypePlugins: [
			[rehypeKatex, { katex }],
			[rehypeCallouts, { theme: siteConfig.rehypeCallouts.theme }],
			rehypeSlug,
			rehypeMermaid,
			rehypePlantuml,
			rehypeFigure,
			rehypeResponsiveImages,
			[rehypeExternalLinks, { siteUrl: siteConfig.site_url }],
			[rehypeEmailProtection, { method: "base64" }], // 邮箱保护插件，支持 'base64' 或 'rot13'
			[
				rehypeComponents,
				{
					components: {
						github: GithubCardComponent,
					},
				},
			],
			[
				rehypeAutolinkHeadings,
				{
					behavior: "append",
					properties: {
						className: ["anchor"],
					},
					content: {
						type: "element",
						tagName: "span",
						properties: {
							className: ["anchor-icon"],
							"data-pagefind-ignore": true,
						},
						children: [
							{
								type: "text",
								value: "#",
							},
						],
					},
				},
			],
			rehypeLocalSvgDimensions,
		],
	},
	vite: {
		plugins: [tailwindcss()],
		server: {
			watch: {
				ignored: ["**/package/**", "**/Firefly-docs/**"],
			},
		},
		resolve: {
			alias: {
				"@rehype-callouts-theme": `rehype-callouts/theme/${siteConfig.rehypeCallouts.theme}`,
			},
		},
		build: {
			minify: "esbuild",
			esbuildOptions: {
				minify: true,
				// 移除 console.log 和 debugger
				drop: ["console", "debugger"],
			},
			rollupOptions: {
				onwarn(warning, warn) {
					// temporarily suppress this warning
					if (
						warning.message.includes("is dynamically imported by") &&
						warning.message.includes("but also statically imported by")
					) {
						return;
					}
					warn(warning);
				},
			},
			// CSS 优化
			cssCodeSplit: true,
			cssMinify: "esbuild",
			assetsInlineLimit: 4096,
		},
	},
});
