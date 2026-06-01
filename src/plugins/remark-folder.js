const FOLDER_OPEN_RE = /^<folder(?<attrs>(?:\s+[^>]*)?)>\s*$/i;
const FOLDER_CLOSE_RE = /^<\/folder>\s*$/i;

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

function isTruthy(value) {
	if (value === true) return true;
	if (value == null) return false;

	return ["", "1", "true", "yes", "open", "expanded"].includes(
		String(value).trim().toLowerCase(),
	);
}

function resolveOpenState(attributes) {
	if ("open" in attributes) return isTruthy(attributes.open);
	if ("defaultopen" in attributes) return isTruthy(attributes.defaultopen);
	if ("expanded" in attributes) return isTruthy(attributes.expanded);
	if ("default" in attributes) return isTruthy(attributes.default);

	return false;
}

function resolveStyle(attributes) {
	const style = String(attributes.style ?? "1").trim();
	return ["1", "2", "3"].includes(style) ? style : "1";
}

function resolveScrollHeight(attributes) {
	const value =
		attributes.height ?? attributes.maxheight ?? attributes["max-height"];
	if (value == null || value === true) return null;

	const height = String(value).trim();
	if (/^\d+(?:\.\d+)?$/.test(height)) return `${height}px`;
	if (/^\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)$/.test(height)) return height;

	return null;
}

function createOpeningHtml(attributes) {
	const title =
		attributes.title ?? attributes.summary ?? attributes.name ?? "折叠内容";
	const open = resolveOpenState(attributes);
	const style = resolveStyle(attributes);
	const scrollHeight = style === "3" ? resolveScrollHeight(attributes) : null;

	return {
		type: "folder",
		data: {
			hName: "details",
			hProperties: {
				className: ["folded-block", `folded-block--style-${style}`],
				dataStyle: style,
				...(open ? { open: true } : {}),
				...(scrollHeight
					? { style: `--folded-block-scroll-height: ${scrollHeight};` }
					: {}),
			},
		},
		children: [
			{
				type: "folderSummary",
				data: {
					hName: "summary",
					hProperties: { className: ["folded-block__summary"] },
				},
				children: [
					{
						type: "folderMarker",
						data: {
							hName: "span",
							hProperties: {
								className: ["folded-block__marker"],
								ariaHidden: "true",
							},
						},
						children: [],
					},
					{
						type: "folderTitle",
						data: {
							hName: "span",
							hProperties: { className: ["folded-block__title"] },
						},
						children: [{ type: "text", value: String(title) }],
					},
				],
			},
			{
				type: "folderBody",
				data: {
					hName: "div",
					hProperties: { className: ["folded-block__body"] },
				},
				children: [],
			},
		],
	};
}

export function remarkFolder() {
	return (tree) => {
		function transformChildren(parent) {
			if (!Array.isArray(parent.children)) return;

			let index = 0;
			while (index < parent.children.length) {
				const node = parent.children[index];

				if (node.type !== "html") {
					transformChildren(node);
					index += 1;
					continue;
				}

				const openMatch = node.value.trim().match(FOLDER_OPEN_RE);
				if (!openMatch) {
					index += 1;
					continue;
				}

				let depth = 1;
				let endIndex = -1;

				for (
					let cursor = index + 1;
					cursor < parent.children.length;
					cursor += 1
				) {
					const current = parent.children[cursor];
					if (current.type !== "html") continue;

					const value = current.value.trim();
					if (FOLDER_OPEN_RE.test(value)) depth += 1;
					if (FOLDER_CLOSE_RE.test(value)) depth -= 1;

					if (depth === 0) {
						endIndex = cursor;
						break;
					}
				}

				if (endIndex === -1) {
					index += 1;
					continue;
				}

				const folderNode = createOpeningHtml(
					parseAttributes(openMatch.groups?.attrs),
				);
				const bodyNode = folderNode.children[1];
				bodyNode.children = parent.children.slice(index + 1, endIndex);
				transformChildren(bodyNode);

				parent.children.splice(index, endIndex - index + 1, folderNode);
				index += 1;
			}
		}

		transformChildren(tree);
	};
}
