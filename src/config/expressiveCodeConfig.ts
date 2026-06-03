import type { ExpressiveCodeConfig } from "../types/config";

/**
 * expressive-code config
 * @see https://expressive-code.com/
 * Restart the Astro dev server after changing this config.
 */
export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Dark theme.
	darkTheme: "one-dark-pro",

	// Light theme.
	lightTheme: "one-light",

	// See expressive-code docs for more themes:
	// https://expressive-code.com/guides/themes/

	// Code block collapsible plugin config.
	pluginCollapsible: {
		enable: true,
		lineThreshold: 11,
		previewLines: 6,
		defaultCollapsed: true,
	},

	pluginLanguageBadge: {
		enable: false,
	},
};
