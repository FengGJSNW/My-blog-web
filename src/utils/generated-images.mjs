import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join(
	process.cwd(),
	"public",
	"assets",
	"generated",
	"manifest.json",
);

let manifestCache;

export function stripImageUrl(value = "") {
	return String(value).split("#")[0].split("?")[0];
}

function toPosix(value) {
	return value.replace(/\\/g, "/");
}

function normalizePosixPath(value) {
	return path.posix.normalize(toPosix(value));
}

function decodePath(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function loadGeneratedImageManifest() {
	if (manifestCache) return manifestCache;

	try {
		manifestCache = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	} catch {
		manifestCache = {};
	}

	return manifestCache;
}

export function getGeneratedImage(src, options = {}) {
	if (!src || typeof src !== "string") return null;
	if (
		src.startsWith("http://") ||
		src.startsWith("https://") ||
		src.startsWith("data:")
	) {
		return null;
	}

	const manifest = options.manifest ?? loadGeneratedImageManifest();
	const cleanSrc = decodePath(stripImageUrl(src));
	const candidates = [];

	if (cleanSrc.startsWith("/")) {
		candidates.push(cleanSrc);
		candidates.push(cleanSrc.replace(/^\/+/, ""));
	} else {
		const normalizedSrc = normalizePosixPath(cleanSrc);
		candidates.push(normalizedSrc);

		if (options.basePath) {
			const basePath = normalizePosixPath(String(options.basePath)).replace(/^\/+/, "");
			candidates.push(normalizePosixPath(`src/${basePath}/${normalizedSrc}`));
			candidates.push(normalizePosixPath(`${basePath}/${normalizedSrc}`));
		}

		candidates.push(normalizePosixPath(`src/${normalizedSrc}`));
		candidates.push(`/${normalizedSrc}`);
	}

	for (const candidate of candidates) {
		if (manifest[candidate]) return manifest[candidate];
	}

	return null;
}

export function selectGeneratedSources(sources = [], requestedWidths) {
	if (!Array.isArray(sources) || sources.length === 0) return [];

	const sortedSources = [...sources].sort((a, b) => a.width - b.width);
	if (!Array.isArray(requestedWidths) || requestedWidths.length === 0) {
		return sortedSources;
	}

	const selected = new Map();
	for (const requestedWidth of requestedWidths) {
		const target = Number(requestedWidth);
		if (!Number.isFinite(target) || target <= 0) continue;
		const source =
			sortedSources.find((item) => item.width >= target) ??
			sortedSources[sortedSources.length - 1];
		if (source) selected.set(source.width, source);
	}

	return [...selected.values()].sort((a, b) => a.width - b.width);
}

export function buildSrcSet(sources = []) {
	return sources.map((source) => `${source.src} ${source.width}w`).join(", ");
}

export function getDisplaySource(sources = [], preferredWidth = 640) {
	if (!Array.isArray(sources) || sources.length === 0) return null;
	const sortedSources = [...sources].sort((a, b) => a.width - b.width);
	return (
		sortedSources.find((source) => source.width >= preferredWidth) ??
		sortedSources[sortedSources.length - 1]
	);
}

export function getAspectRatio(entry) {
	if (!entry?.width || !entry?.height) return undefined;
	return `${entry.width} / ${entry.height}`;
}
