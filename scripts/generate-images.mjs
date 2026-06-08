import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = process.cwd();
const generatedDir = path.join(projectRoot, "public", "assets", "generated");
const originalDir = path.join(generatedDir, "original");
const manifestPath = path.join(generatedDir, "manifest.json");
const aliasManifestPath = path.join(projectRoot, "scripts", "generated-image-aliases.json");
const generatedUrlBase = "/assets/generated";

const rasterImageExts = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
const sourceDirs = [
	{ dir: path.join(projectRoot, "public", "assets", "images"), public: true },
	{ dir: path.join(projectRoot, "src", "content"), public: false },
];
const placeholderWidth = 64;
const candidateWidths = [192, 240, 256, 320, 384, 512, 640, 960, 1280, 1920];
const legacyGeneratedAliasSeeds = [
	{
		sourceSuffix: "misc/picture/Challenge.png",
		hashes: ["43ead8cd13dc"],
	},
	{
		sourceSuffix: "web/HiddenSecret/flag.png",
		hashes: ["0a40b46b5e84"],
	},
];

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

async function readJsonFile(absPath, fallback) {
	try {
		return JSON.parse(await fs.readFile(absPath, "utf8"));
	} catch {
		return fallback;
	}
}

function generatedUrlToPath(url) {
	if (!url?.startsWith(`${generatedUrlBase}/`)) return null;
	return path.join(projectRoot, "public", url.replace(/^\/+/, ""));
}

function isGeneratedUrl(url) {
	return typeof url === "string" && url.startsWith(`${generatedUrlBase}/`);
}

function collectExpectedFiles(manifest, aliasRecords = []) {
	const expected = new Set([manifestPath, aliasManifestPath]);
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
	for (const record of aliasRecords) {
		const absPath = generatedUrlToPath(record.aliasUrl);
		if (absPath) expected.add(absPath);
	}
	return expected;
}

async function cleanupStaleGeneratedFiles(manifest, aliasRecords = []) {
	const expected = collectExpectedFiles(manifest, aliasRecords);
	const files = await listAllFiles(generatedDir);
	await Promise.all(
		files.map(async (file) => {
			if (
				file === manifestPath ||
				file === `${manifestPath}.tmp` ||
				file === aliasManifestPath ||
				file === `${aliasManifestPath}.tmp`
			) return;
			if (expected.has(file)) return;
			await fs.rm(file, { force: true });
		}),
	);
}

function replaceGeneratedHash(fileName, hash) {
	return fileName.replace(/-[0-9a-f]{12}-(\d+\.webp|original\.[^.]+)$/i, `-${hash}-$1`);
}

function replaceGeneratedHashInUrl(url, hash) {
	const slashIndex = url.lastIndexOf("/");
	const dir = slashIndex >= 0 ? url.slice(0, slashIndex + 1) : "";
	const fileName = slashIndex >= 0 ? url.slice(slashIndex + 1) : url;
	return `${dir}${replaceGeneratedHash(fileName, hash)}`;
}

function getEntryDescriptors(entry) {
	const descriptors = [];
	if (isGeneratedUrl(entry?.placeholder)) {
		descriptors.push({
			kind: "placeholder",
			aliasUrl: entry.placeholder,
		});
	}

	for (const source of entry?.sources ?? []) {
		if (!isGeneratedUrl(source.src)) continue;
		descriptors.push({
			kind: "source",
			width: source.width,
			aliasUrl: source.src,
		});
	}

	if (isGeneratedUrl(entry?.original)) {
		descriptors.push({
			kind: "original",
			aliasUrl: entry.original,
		});
	}

	return descriptors;
}

function getSourceForAlias(entry, record) {
	if (!entry) return null;
	if (record.kind === "placeholder") return entry.placeholder;
	if (record.kind === "original") return entry.original;
	if (record.kind !== "source") return null;

	const sources = Array.isArray(entry.sources)
		? [...entry.sources].sort((a, b) => a.width - b.width)
		: [];
	if (sources.length === 0) return null;

	const width = Number(record.width);
	const source =
		sources.find((item) => item.width === width) ??
		sources.find((item) => item.width >= width) ??
		sources[sources.length - 1];

	return source?.src ?? null;
}

function canAliasUrl(sourceUrl, aliasUrl) {
	if (!isGeneratedUrl(sourceUrl) || !isGeneratedUrl(aliasUrl)) return false;
	if (sourceUrl === aliasUrl) return false;

	const sourcePath = generatedUrlToPath(sourceUrl);
	const aliasPath = generatedUrlToPath(aliasUrl);
	if (!sourcePath || !aliasPath) return false;

	return path.extname(sourcePath).toLowerCase() === path.extname(aliasPath).toLowerCase();
}

function normalizeAliasRecord(record) {
	if (!record || typeof record !== "object") return null;
	if (typeof record.key !== "string" || typeof record.aliasUrl !== "string") return null;
	if (!["placeholder", "source", "original"].includes(record.kind)) return null;

	return {
		key: toPosix(record.key),
		kind: record.kind,
		...(record.kind === "source" ? { width: Number(record.width) } : {}),
		aliasUrl: record.aliasUrl,
	};
}

function addAliasRecord(records, record) {
	const normalized = normalizeAliasRecord(record);
	if (!normalized) return;
	if (normalized.kind === "source" && !Number.isFinite(normalized.width)) return;

	const id = [
		normalized.key,
		normalized.kind,
		normalized.width ?? "",
		normalized.aliasUrl,
	].join("|");

	if (records.has(id)) return;
	records.set(id, normalized);
}

function inferAliasRecordsFromPreviousManifest(manifest, previousManifest) {
	const records = new Map();

	for (const [key, entry] of Object.entries(manifest)) {
		const previousEntry = previousManifest?.[key];
		if (!previousEntry) continue;

		for (const descriptor of getEntryDescriptors(previousEntry)) {
			const sourceUrl = getSourceForAlias(entry, descriptor);
			if (!canAliasUrl(sourceUrl, descriptor.aliasUrl)) continue;
			addAliasRecord(records, { key, ...descriptor });
		}
	}

	return records;
}

function createManifestSnapshot(manifest) {
	const snapshot = {};

	for (const [key, entry] of Object.entries(manifest)) {
		snapshot[key] = {
			placeholder: entry.placeholder,
			sources: (entry.sources ?? []).map((source) => ({
				width: source.width,
				src: source.src,
			})),
			original: entry.original,
			source: entry.source,
		};
	}

	return snapshot;
}

function findManifestKeyBySuffix(manifest, sourceSuffix) {
	const normalizedSuffix = toPosix(sourceSuffix);
	for (const [key, entry] of Object.entries(manifest)) {
		const source = toPosix(entry?.source ?? key);
		if (source.endsWith(normalizedSuffix)) return key;
	}
	return null;
}

function inferAliasRecordsFromSeeds(manifest) {
	const records = new Map();

	for (const seed of legacyGeneratedAliasSeeds) {
		const key = findManifestKeyBySuffix(manifest, seed.sourceSuffix);
		if (!key) continue;

		const entry = manifest[key];
		for (const descriptor of getEntryDescriptors(entry)) {
			for (const hash of seed.hashes) {
				const aliasUrl = replaceGeneratedHashInUrl(descriptor.aliasUrl, hash);
				const sourceUrl = getSourceForAlias(entry, descriptor);
				if (!canAliasUrl(sourceUrl, aliasUrl)) continue;
				addAliasRecord(records, { key, ...descriptor, aliasUrl });
			}
		}
	}

	return records;
}

function buildAliasRecords(manifest, previousManifests, previousAliasManifest) {
	const records = new Map();

	for (const record of previousAliasManifest?.records ?? []) {
		const normalized = normalizeAliasRecord(record);
		if (!normalized) continue;
		const sourceUrl = getSourceForAlias(manifest[normalized.key], normalized);
		if (!canAliasUrl(sourceUrl, normalized.aliasUrl)) continue;
		addAliasRecord(records, normalized);
	}

	for (const previousManifest of previousManifests) {
		if (!previousManifest || typeof previousManifest !== "object") continue;
		for (const record of inferAliasRecordsFromPreviousManifest(manifest, previousManifest).values()) {
			addAliasRecord(records, record);
		}
	}

	for (const record of inferAliasRecordsFromSeeds(manifest).values()) {
		addAliasRecord(records, record);
	}

	return [...records.values()].sort((a, b) => {
		const aId = `${a.key}|${a.kind}|${a.width ?? ""}|${a.aliasUrl}`;
		const bId = `${b.key}|${b.kind}|${b.width ?? ""}|${b.aliasUrl}`;
		return aId.localeCompare(bId);
	});
}

async function createGeneratedAliases(manifest, records) {
	let aliases = 0;

	for (const record of records) {
		const sourceUrl = getSourceForAlias(manifest[record.key], record);
		if (!canAliasUrl(sourceUrl, record.aliasUrl)) continue;

		const sourceAbs = generatedUrlToPath(sourceUrl);
		const aliasAbs = generatedUrlToPath(record.aliasUrl);
		if (!sourceAbs || !aliasAbs) continue;

		await ensureDir(path.dirname(aliasAbs));
		await fs.copyFile(sourceAbs, aliasAbs);
		aliases += 1;
	}

	return aliases;
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
	await ensureDir(path.dirname(aliasManifestPath));

	const previousManifest = await readJsonFile(manifestPath, {});
	const previousAliasManifest = await readJsonFile(aliasManifestPath, { records: [] });

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
	let aliases = 0;

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

	const aliasRecords = buildAliasRecords(
		manifest,
		[previousAliasManifest.entries, previousManifest],
		previousAliasManifest,
	);
	await cleanupStaleGeneratedFiles(manifest, aliasRecords);
	aliases = await createGeneratedAliases(manifest, aliasRecords);
	await fs.writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
	await fs.rename(`${manifestPath}.tmp`, manifestPath);
	await fs.writeFile(
		`${aliasManifestPath}.tmp`,
		`${JSON.stringify(
			{
				version: 1,
				records: aliasRecords,
				entries: createManifestSnapshot(manifest),
			},
			null,
			2,
		)}\n`,
	);
	await fs.rename(`${aliasManifestPath}.tmp`, aliasManifestPath);

	console.log(
		`[generate-images] processed ${processed} images, fallback ${fallback}, skipped ${skipped}, aliases ${aliases}, alias records ${aliasRecords.length}, manifest: ${toPosix(path.relative(projectRoot, manifestPath))}`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
