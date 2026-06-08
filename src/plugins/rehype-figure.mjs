import fs from "node:fs";
import path from "node:path";
import { h } from "hastscript";
import { visit } from "unist-util-visit";
import { shouldAddNoReferrer } from "../utils/image-utils.ts";

function stripImageUrl(value = "") {
	return String(value).split("#")[0].split("?")[0];
}

function decodePath(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
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

function getLocalSvgDimensions(src) {
	const cleanSrc = decodePath(stripImageUrl(src));
	if (!cleanSrc.startsWith("/__local_svg/")) return null;

	const absPath = path.join(process.cwd(), "public", cleanSrc.replace(/^\/+/, ""));
	if (!fs.existsSync(absPath)) return null;

	return parseSvgIntrinsicSize(fs.readFileSync(absPath, "utf8"));
}

/**
 * 将带有 alt 文本的图片转换为包含 figcaption 的 figure 元素的 rehype 插件
 *
 * @returns {Function} A transformer function for the rehype plugin
 */
export default function rehypeFigure() {
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			// 只处理 img 元素
			if (node.tagName !== "img") {
				return;
			}

			// 跳过已由其它插件接管渲染的图片（例如 plantuml）
			const classRaw = node.properties?.className;
			const classNames = Array.isArray(classRaw)
				? classRaw
				: typeof classRaw === "string"
					? classRaw.split(/\s+/)
					: [];
			if (classNames.includes("plantuml-image")) {
				return;
			}

			const imgProps = { ...node.properties };

			// 添加 referrerpolicy（如果需要）解决 403 问题
			// 无论是否有 alt，都要检查并添加 referrerpolicy
			if (imgProps.src && shouldAddNoReferrer(imgProps.src)) {
				imgProps.referrerpolicy = "no-referrer";
			}

			const svgDimensions = getLocalSvgDimensions(String(imgProps.src || ""));
			if (svgDimensions) {
				imgProps.width = imgProps.width ?? svgDimensions.width;
				imgProps.height = imgProps.height ?? svgDimensions.height;
			}

			// 获取 alt 属性
			const alt = imgProps.alt;

			// 如果没有 alt 属性或 alt 为空字符串，则只更新属性并保持原样
			if (!alt || alt.trim() === "") {
				node.properties = imgProps;
				return;
			}

			// 创建 figure 元素，包含处理后的 img 和居中的 figcaption
			const figure = h("figure", [
				// 使用原始属性的 img 节点
				h("img", {
					...imgProps,
				}),
				h("figcaption", alt),
			]);

			// 居中显示
			const centerFigure = h("center", figure);

			// 替换当前的 img 节点为 figure 节点
			if (parent && typeof index === "number") {
				parent.children[index] = centerFigure;
			}
		});
	};
}
