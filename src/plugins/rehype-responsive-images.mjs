import path from "node:path";
import { h } from "hastscript";
import { visit } from "unist-util-visit";
import {
	buildSrcSet,
	getAspectRatio,
	getDisplaySource,
	getGeneratedImage,
	loadGeneratedImageManifest,
	selectGeneratedSources,
	stripImageUrl,
} from "../utils/generated-images.mjs";
import { shouldAddNoReferrer } from "../utils/image-utils.ts";

const articleWidths = [320, 640, 960, 1280];
const articleSizes = "(max-width: 768px) 100vw, 760px";

function toPosix(value) {
	return value.replace(/\\/g, "/");
}

function decodePath(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function classNames(properties = {}) {
	const raw = properties.className;
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "string") return raw.split(/\s+/).filter(Boolean);
	return [];
}

function isRemote(src) {
	return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:");
}

function isSvg(src) {
	return stripImageUrl(src).toLowerCase().endsWith(".svg");
}

function resolveFromMarkdownFile(src, file, manifest) {
	if (!src || src.startsWith("/") || isRemote(src)) return null;

	const mdPath = file.history?.[0] || file.path;
	if (!mdPath) return null;

	const cleanSrc = decodePath(stripImageUrl(src));
	const absPath = path.resolve(path.dirname(mdPath), cleanSrc);
	const key = toPosix(path.relative(process.cwd(), absPath));
	return manifest[key] ?? null;
}

function resolveGeneratedImage(src, file, manifest) {
	return (
		getGeneratedImage(src, { manifest }) ??
		resolveFromMarkdownFile(src, file, manifest)
	);
}

function withNoReferrer(properties) {
	if (properties.src && shouldAddNoReferrer(String(properties.src))) {
		return { ...properties, referrerpolicy: "no-referrer" };
	}
	return properties;
}

function createBlurImageNode(properties, record, parent) {
	const selectedSources = selectGeneratedSources(record.sources, articleWidths);
	const displaySource = getDisplaySource(selectedSources, 640);
	if (!displaySource) return null;

	const original = record.original;
	const alt = properties.alt ?? "";
	const imageClassNames = [
		"blur-image-main",
		...classNames(properties).filter((name) => name !== "blur-image-main"),
	];
	const image = h("img", {
		...properties,
		src: displaySource.src,
		srcSet: buildSrcSet(selectedSources),
		sizes: articleSizes,
		alt,
		width: record.width,
		height: record.height,
		loading: "lazy",
		decoding: "async",
		className: imageClassNames,
		"data-original-src": original,
		"data-responsive-image": "true",
	});

	const placeholder = h("img", {
		src: record.placeholder,
		alt: "",
		"aria-hidden": "true",
		loading: "lazy",
		decoding: "async",
		className: ["blur-image-placeholder"],
	});

	const wrapper = h(
		"span",
		{
			className: ["blur-image-wrapper", "markdown-blur-image"],
			style: getAspectRatio(record)
				? `--blur-image-aspect-ratio: ${getAspectRatio(record)}`
				: undefined,
			"data-blur-image": "true",
		},
		[placeholder, image],
	);

	if (parent?.tagName === "a") return wrapper;

	return h(
		"a",
		{
			href: original,
			rel: "noopener",
			className: ["blur-image-link"],
			dataFancybox: "article-images",
			dataSrc: original,
			dataType: "image",
			dataThumbSrc: displaySource.src,
		},
		[wrapper],
	);
}

function createOriginalOnlyImageNode(properties, record, parent) {
	const original = record.original ?? String(properties.src ?? "");
	if (!original) return null;

	const image = h("img", {
		...properties,
		src: original,
		alt: properties.alt ?? "",
		loading: "lazy",
		decoding: "async",
		className: classNames(properties),
		"data-original-src": original,
		"data-responsive-image": "fallback",
	});

	if (parent?.tagName === "a") {
		parent.properties = {
			...parent.properties,
			href: original,
			rel: "noopener",
			className: [
				...new Set([...classNames(parent.properties), "blur-image-link"]),
			],
			dataFancybox: "article-images",
			dataSrc: original,
			dataType: "image",
			dataThumbSrc: original,
		};
		delete parent.properties.target;
		return image;
	}

	return h(
		"a",
		{
			href: original,
			rel: "noopener",
			className: ["blur-image-link"],
			dataFancybox: "article-images",
			dataSrc: original,
			dataType: "image",
			dataThumbSrc: original,
		},
		[image],
	);
}

function createLinkedOriginalNode(node, parent) {
	const src = String(node.properties?.src ?? "");
	if (!src || parent?.tagName === "a" || (!src.startsWith("/") && !isRemote(src))) {
		return null;
	}

	node.properties = withNoReferrer({
		...node.properties,
		loading: node.properties?.loading ?? "lazy",
		decoding: node.properties?.decoding ?? "async",
		"data-original-src": src,
	});

	return h(
		"a",
		{
			href: src,
			rel: "noopener",
			className: ["blur-image-link"],
			dataFancybox: "article-images",
			dataSrc: src,
			dataType: "image",
			dataThumbSrc: src,
		},
		[node],
	);
}

export default function rehypeResponsiveImages() {
	return (tree, file) => {
		const manifest = loadGeneratedImageManifest();

		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "img" || !parent || typeof index !== "number") return;
			if (node.properties?.["data-responsive-image"]) return;

			const properties = withNoReferrer({ ...node.properties });
			const src = String(properties.src ?? "");
			if (!src) return;

			const classes = classNames(properties);
			if (classes.includes("plantuml-image")) return;

			const record = isSvg(src)
				? null
				: resolveGeneratedImage(src, file, manifest);
			if (record) {
				const optimizedNode =
					createBlurImageNode(properties, record, parent) ??
					createOriginalOnlyImageNode(properties, record, parent);
				if (optimizedNode) parent.children[index] = optimizedNode;
				return;
			}

			const linkedNode = createLinkedOriginalNode(node, parent);
			if (linkedNode) {
				parent.children[index] = linkedNode;
				return;
			}

			node.properties = {
				...properties,
				loading: properties.loading ?? "lazy",
				decoding: properties.decoding ?? "async",
			};
		});
	};
}
