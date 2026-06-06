import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = process.cwd();
const generatedDir = path.join(projectRoot, "public", "assets", "generated");
const originalDir = path.join(generatedDir, "original");
const manifestPath = path.join(generatedDir, "manifest.json");
const generatedUrlBase = "/assets/generated";

const rasterImageExts = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
const sourceDirs = [
	{ dir: path.join(projectRoot, "public", "assets", "images"), public: true },
	{ dir: path.join(projectRoot, "src", "content"), public: false },
];
const placeholderWidth = 64;
const candidateWidths = [256, 320, 512, 640, 960, 1280, 1920];

function toPosix(value) {
	return value.replace(/\\/g, "/");
}

function stripGeneratedRoot(absPath) {
	return toPosix(path.relative(projectRoot, absPath));
}

function getManifestKey(absPath, isPublic) {
	const rel = stripGeneratedRoot(absPath);
	if (isPublic && rel.startsWith("public/")) {
		return `/${rel.slice("public/".length)}`;
	}
	return rel;
}

function safeBaseName(absPath) {
	const parsed = path.parse(absPath);
	const cleaned = parsed.name
		.normalize("NFKD")
		.replace(/[^\w.-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
	return cleaned || "image";
}

async function pathExists(absPath) {
	try {
		await fs.access(absPath);
		return true;
	} catch {
		return false;
	}
}

async function ensureDir(absPath) {
	await fs.mkdir(absPath, { recursive: true });
}

async function listImages(dir) {
	if (!(await pathExists(dir))) return [];

	const result = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const absPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			result.push(...(await listImages(absPath)));
			continue;
		}

		if (!entry.isFile()) continue;
		if (rasterImageExts.has(path.extname(entry.name).toLowerCase())) {
			result.push(absPath);
		}
	}
	return result;
}

async function hashFile(absPath) {
	const buffer = await fs.readFile(absPath);
	return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

function pickWidths(sourceWidth) {
	const widths = candidateWidths.filter((width) => width <= sourceWidth);
	if (widths.length === 0) return [sourceWidth];
	if (widths.at(-1) !== sourceWidth && sourceWidth < candidateWidths.at(-1)) {
		widths.push(sourceWidth);
	}
	return [...new Set(widths)].sort((a, b) => a - b);
}

async function writeWebpVariant(absPath, outPath, width, quality) {
	if (await pathExists(outPath)) return false;

	await sharp(absPath, {
		animated: false,
		limitInputPixels: false,
	})
		.rotate()
		.resize({
			width,
			withoutEnlargement: true,
		})
		.webp({
			quality,
			effort: 3,
		})
		.toFile(outPath);

	return true;
}

async function copyOriginal(absPath, outPath) {
	if (await pathExists(outPath)) return false;
	await fs.copyFile(absPath, outPath);
	return true;
}

function generatedUrlToPath(url) {
	if (!url?.startsWith(`${generatedUrlBase}/`)) return null;
	return path.join(projectRoot, "public", url.replace(/^\/+/, ""));
}

function collectExpectedFiles(manifest) {
	const expected = new Set([manifestPath]);
	for (const entry of Object.values(manifest)) {
		const urls = [
			entry.placeholder,
			entry.original,
			...(entry.sources ?? []).map((source) => source.src),
		];
		for (const item of urls) {
			const absPath = generatedUrlToPath(item);
			if (absPath) expected.add(absPath);
		}
	}
	return expected;
}

async function cleanupStaleGeneratedFiles(manifest) {
	const expected = collectExpectedFiles(manifest);
	const files = await listAllFiles(generatedDir);
	await Promise.all(
		files.map(async (file) => {
			if (file === manifestPath || file === `${manifestPath}.tmp`) return;
			if (expected.has(file)) return;
			await fs.rm(file, { force: true });
		}),
	);
}

async function listAllFiles(dir) {
	if (!(await pathExists(dir))) return [];
	const result = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const absPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			result.push(...(await listAllFiles(absPath)));
		} else if (entry.isFile()) {
			result.push(absPath);
		}
	}
	return result;
}

async function processImage(absPath, isPublic) {
	const metadata = await sharp(absPath, { animated: false, limitInputPixels: false }).metadata();
	if (!metadata.width || !metadata.height) {
		throw new Error("missing image dimensions");
	}

	const rel = stripGeneratedRoot(absPath);
	const hash = await hashFile(absPath);
	const baseName = safeBaseName(absPath);
	const prefix = `${baseName}-${hash}`;
	const key = getManifestKey(absPath, isPublic);

	const placeholderTarget = Math.max(1, Math.min(placeholderWidth, metadata.width));
	const placeholderName = `${prefix}-${placeholderWidth}.webp`;
	const placeholderAbs = path.join(generatedDir, placeholderName);
	await writeWebpVariant(absPath, placeholderAbs, placeholderTarget, 45);

	const widths = pickWidths(metadata.width);
	const sources = [];
	for (const width of widths) {
		const outName = `${prefix}-${width}.webp`;
		const outAbs = path.join(generatedDir, outName);
		await writeWebpVariant(absPath, outAbs, width, 82);
		sources.push({
			width,
			src: `${generatedUrlBase}/${outName}`,
		});
	}

	let original = key;
	if (!isPublic) {
		const originalExt = path.extname(absPath).toLowerCase();
		const originalName = `${prefix}-original${originalExt}`;
		const originalAbs = path.join(originalDir, originalName);
		await copyOriginal(absPath, originalAbs);
		original = `${generatedUrlBase}/original/${originalName}`;
	}

	return {
		key,
		entry: {
			width: metadata.width,
			height: metadata.height,
			placeholder: `${generatedUrlBase}/${placeholderName}`,
			sources,
			original,
			source: rel,
		},
	};
}

async function processOriginalOnlyImage(absPath, isPublic, reason) {
	const rel = stripGeneratedRoot(absPath);
	const hash = await hashFile(absPath);
	const baseName = safeBaseName(absPath);
	const prefix = `${baseName}-${hash}`;
	const key = getManifestKey(absPath, isPublic);

	let original = key;
	if (!isPublic) {
		const originalExt = path.extname(absPath).toLowerCase();
		const originalName = `${prefix}-original${originalExt}`;
		const originalAbs = path.join(originalDir, originalName);
		await copyOriginal(absPath, originalAbs);
		original = `${generatedUrlBase}/original/${originalName}`;
	}

	return {
		key,
		entry: {
			sources: [],
			original,
			source: rel,
			unoptimized: true,
			reason,
		},
	};
}

async function main() {
	await ensureDir(generatedDir);
	await ensureDir(originalDir);

	const sourceFiles = new Map();
	for (const source of sourceDirs) {
		const files = await listImages(source.dir);
		for (const absPath of files) {
			sourceFiles.set(absPath, source.public);
		}
	}

	const manifest = {};
	let processed = 0;
	let skipped = 0;
	let fallback = 0;

	for (const [absPath, isPublic] of sourceFiles) {
		try {
			const { key, entry } = await processImage(absPath, isPublic);
			manifest[key] = entry;
			processed += 1;
		} catch (error) {
			try {
				const { key, entry } = await processOriginalOnlyImage(
					absPath,
					isPublic,
					error.message,
				);
				manifest[key] = entry;
				fallback += 1;
				console.warn(
					`[generate-images] original-only fallback ${stripGeneratedRoot(absPath)}: ${error.message}`,
				);
			} catch (fallbackError) {
				skipped += 1;
				console.warn(
					`[generate-images] skipped ${stripGeneratedRoot(absPath)}: ${fallbackError.message}`,
				);
			}
		}
	}

	await cleanupStaleGeneratedFiles(manifest);
	await fs.writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
	await fs.rename(`${manifestPath}.tmp`, manifestPath);

	console.log(
		`[generate-images] processed ${processed} images, fallback ${fallback}, skipped ${skipped}, manifest: ${toPosix(path.relative(projectRoot, manifestPath))}`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
