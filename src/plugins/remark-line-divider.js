import { visit } from "unist-util-visit";

const LINE_RE = /^<line(?<attrs>(?:\s+[^>]*)?)>\s*$/i;

function parseAttributes(value = "") {
	const attributes = {};
	const attrRe =
		/([:@A-Za-z_][:@A-Za-z0-9_.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

	let match = attrRe.exec(value);
	while (match !== null) {
		const [, name, doubleQuoted, singleQuoted, unquoted] = match;
		attributes[name.toLowerCase()] =
			doubleQuoted ?? singleQuoted ?? unquoted ?? true;
		match = attrRe.exec(value);
	}

	return attributes;
}

function normalizeLength(value, fallback) {
	if (value == null || value === true) return fallback;

	const raw = String(value).trim();
	if (/^-?\d+(?:\.\d+)?$/.test(raw)) return `${raw}px`;
	if (/^-?\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)$/i.test(raw)) return raw;

	return fallback;
}

function normalizeCount(value) {
	const count = Number.parseInt(String(value ?? "1"), 10);
	if (!Number.isFinite(count)) return 1;
	return Math.min(Math.max(count, 1), 12);
}

function normalizeColor(value) {
	if (value == null || value === true) return null;

	const color = String(value).trim();
	if (!color || /[;"{}<>]/.test(color)) return null;

	return color;
}

function getAttribute(attributes, ...names) {
	for (const name of names) {
		const value = attributes[name.toLowerCase()];
		if (value != null) return value;
	}

	return undefined;
}

function createLineDivider(attributes) {
	const paddingTop = normalizeLength(
		getAttribute(attributes, "paddingtop", "padding-top"),
		"1.25rem",
	);
	const paddingBottom = normalizeLength(
		getAttribute(attributes, "paddingbottom", "padding-bottom"),
		"1.25rem",
	);
	const lineHeight = normalizeLength(
		getAttribute(attributes, "lineheight", "line-height"),
		"1px",
	);
	const lineDistance = normalizeLength(
		getAttribute(attributes, "linedistance", "line-distance"),
		"6px",
	);
	const lineCount = normalizeCount(
		getAttribute(attributes, "linecount", "line-count"),
	);
	const lineColor = normalizeColor(
		getAttribute(attributes, "linecolor", "line-color"),
	);

	const style = [
		`--line-divider-padding-top: ${paddingTop}`,
		`--line-divider-padding-bottom: ${paddingBottom}`,
		`--line-divider-height: ${lineHeight}`,
		`--line-divider-distance: ${lineDistance}`,
		lineColor ? `--line-divider-color: ${lineColor}` : null,
	]
		.filter(Boolean)
		.join("; ");

	return {
		type: "lineDivider",
		data: {
			hName: "div",
			hProperties: {
				className: ["line-divider"],
				style,
				ariaHidden: "true",
			},
		},
		children: Array.from({ length: lineCount }, () => ({
			type: "lineDividerRule",
			data: {
				hName: "span",
				hProperties: { className: ["line-divider__rule"] },
			},
			children: [],
		})),
	};
}

export function remarkLineDivider() {
	return (tree) => {
		visit(tree, "html", (node, index, parent) => {
			if (!parent || typeof index !== "number") return;

			const match = node.value.trim().match(LINE_RE);
			if (!match) return;

			parent.children[index] = createLineDivider(
				parseAttributes(match.groups?.attrs),
			);
		});
	};
}
