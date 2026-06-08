/**
 * TOC (Table of Contents) 工具类
 * 用于 SidebarTOC 和 FloatingTOC 的共享逻辑
 */

import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

export interface TOCConfig {
	contentId: string;
	indicatorId: string;
	maxLevel?: number;
	scrollOffset?: number;
}

export class TOCManager {
	private tocItems: HTMLElement[] = [];
	private observer: IntersectionObserver | null = null;
	private minDepth = 10;
	private maxLevel: number;
	private contentId: string;
	private indicatorId: string;
	private scrollOffset: number;
	private headings: HTMLElement[] = [];
	private activeItems: HTMLElement[] = [];
	private pendingActiveUpdate: number | null = null;
	private tocContent: HTMLElement | null = null;
	private tocContainer: Element | null = null;
	private indicator: HTMLElement | null = null;
	private headingMetrics = new Map<string, number>();
	private headingMetricsDirty = true;
	private headingMetricsFrame: number | null = null;
	private headingMetricsResizeObserver: ResizeObserver | null = null;
	private headingMetricsMutationObserver: MutationObserver | null = null;
	private headingMetricsContent: Element | null = null;
	private handleViewportChange = (): void => {
		this.scheduleActiveUpdate();
	};
	private handleHeadingMetricsChanged = (): void => {
		this.headingMetricsDirty = true;
		this.scheduleHeadingMetricsRefresh();
	};

	constructor(config: TOCConfig) {
		this.contentId = config.contentId;
		this.indicatorId = config.indicatorId;
		this.maxLevel = config.maxLevel || 3;
		this.scrollOffset = config.scrollOffset || 80;
	}

	/**
	 * 查找文章内容容器
	 */
	private getContentContainer(): Element | null {
		return (
			document.querySelector(".custom-md") ||
			document.querySelector(".prose") ||
			document.querySelector(".markdown-content")
		);
	}

	/**
	 * 查找所有标题
	 */
	private getAllHeadings(): HTMLElement[] {
		const contentContainer = this.getContentContainer();
		if (!contentContainer) {
			return [];
		}
		return Array.from(
			contentContainer.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
		).filter((heading) => !heading.closest(".folded-block"));
	}

	/**
	 * 计算最小深度
	 */
	private calculateMinDepth(headings: HTMLElement[]): number {
		let minDepth = 10;
		headings.forEach((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			minDepth = Math.min(minDepth, depth);
		});
		return minDepth;
	}

	/**
	 * 过滤标题
	 */
	private filterHeadings(headings: HTMLElement[]): HTMLElement[] {
		return Array.from(headings).filter((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			return depth < this.minDepth + this.maxLevel;
		});
	}

	private getFilteredHeadings(): HTMLElement[] {
		const headings = this.getAllHeadings();

		if (headings.length === 0) {
			this.headings = [];
			return [];
		}

		this.minDepth = this.calculateMinDepth(headings);
		this.headings = this.filterHeadings(headings);
		return this.headings;
	}

	private scheduleActiveUpdate(): void {
		if (this.pendingActiveUpdate !== null) return;
		this.pendingActiveUpdate = window.requestAnimationFrame(() => {
			this.pendingActiveUpdate = null;
			this.updateActiveState();
		});
	}

	private scheduleHeadingMetricsRefresh(): void {
		if (this.headingMetricsFrame !== null) return;
		this.headingMetricsFrame = window.requestAnimationFrame(() => {
			this.headingMetricsFrame = null;
			this.refreshHeadingMetrics();
		});
	}

	private refreshHeadingMetrics(force = false): void {
		if (!force && !this.headingMetricsDirty) return;

		const contentContainer = this.getContentContainer();
		if (!contentContainer) {
			this.headingMetrics.clear();
			this.headingMetricsContent = null;
			this.headingMetricsDirty = false;
			return;
		}

		const headings =
			this.headings.length > 0 ? this.headings : this.getFilteredHeadings();
		const contentTop = contentContainer.getBoundingClientRect().top;
		const nextMetrics = new Map<string, number>();

		for (const heading of headings) {
			if (!heading.id || !heading.isConnected) continue;
			nextMetrics.set(
				heading.id,
				Math.round(heading.getBoundingClientRect().top - contentTop),
			);
		}

		this.headingMetrics = nextMetrics;
		this.headingMetricsContent = contentContainer;
		this.headingMetricsDirty = false;
	}

	private disconnectHeadingMetricsMonitor(): void {
		if (this.headingMetricsFrame !== null) {
			window.cancelAnimationFrame(this.headingMetricsFrame);
			this.headingMetricsFrame = null;
		}
		this.headingMetricsResizeObserver?.disconnect();
		this.headingMetricsMutationObserver?.disconnect();
		this.headingMetricsResizeObserver = null;
		this.headingMetricsMutationObserver = null;
		this.headingMetricsContent = null;
	}

	private setupHeadingMetricsMonitor(): void {
		this.disconnectHeadingMetricsMonitor();

		const contentContainer = this.getContentContainer();
		if (!contentContainer) return;

		this.headingMetricsContent = contentContainer;
		this.headingMetricsDirty = true;
		this.refreshHeadingMetrics(true);

		if ("ResizeObserver" in window) {
			this.headingMetricsResizeObserver = new ResizeObserver(
				this.handleHeadingMetricsChanged,
			);
			this.headingMetricsResizeObserver.observe(contentContainer);
			this.headings.forEach((heading) => {
				this.headingMetricsResizeObserver?.observe(heading);
			});
		}

		if ("MutationObserver" in window) {
			this.headingMetricsMutationObserver = new MutationObserver(
				this.handleHeadingMetricsChanged,
			);
			this.headingMetricsMutationObserver.observe(contentContainer, {
				attributes: true,
				childList: true,
				subtree: true,
			});
		}
	}

	private getHeadingScrollOffset(heading: HTMLElement): number {
		const scrollMarginTop = Number.parseFloat(
			window.getComputedStyle(heading).scrollMarginTop,
		);
		return Number.isFinite(scrollMarginTop) && scrollMarginTop > 0
			? scrollMarginTop
			: this.scrollOffset;
	}

	private getHeadingActivationY(heading: HTMLElement): number {
		return this.getHeadingScrollOffset(heading) + 1;
	}

	private getHeadingTargetTop(heading: HTMLElement): number {
		return Math.max(
			0,
			Math.round(
				heading.getBoundingClientRect().top +
					window.pageYOffset -
					this.getHeadingScrollOffset(heading),
			),
		);
	}

	private getArticleRelativeTargetTop(heading: HTMLElement): number {
		const contentContainer =
			this.headingMetricsContent ?? this.getContentContainer();
		if (!contentContainer || !heading.id) return this.getHeadingTargetTop(heading);

		this.refreshHeadingMetrics(this.headingMetricsDirty);

		const relativeTop = this.headingMetrics.get(heading.id);
		if (!Number.isFinite(relativeTop)) return this.getHeadingTargetTop(heading);

		const contentPageTop =
			contentContainer.getBoundingClientRect().top + window.pageYOffset;
		return Math.max(
			0,
			Math.round(
				contentPageTop + Number(relativeTop) - this.getHeadingScrollOffset(heading),
			),
		);
	}

	private scrollToHeading(heading: HTMLElement): void {
		window.scrollTo({
			top: this.getArticleRelativeTargetTop(heading),
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "auto"
				: "smooth",
		});
		this.scheduleActiveUpdate();
	}

	/**
	 * 获取标题的纯文本内容（排除 script/style 标签的文本）
	 */
	private getCleanTextContent(element: HTMLElement): string {
		const clone = element.cloneNode(true) as HTMLElement;
		for (const el of clone.querySelectorAll("script, style")) {
			el.remove();
		}
		return clone.textContent || "";
	}

	/**
	 * 转义 HTML 属性值，避免标题中的引号破坏属性
	 */
	private escapeHtmlAttr(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	/**
	 * 生成徽章内容
	 */
	private generateBadgeContent(depth: number, heading1Count: number): string {
		if (depth === this.minDepth) {
			return heading1Count.toString();
		}
		if (depth === this.minDepth + 1) {
			return '<span class="toc-badge-dot"></span>';
		}
		return '<span class="toc-badge-dot toc-badge-dot-sm"></span>';
	}

	/**
	 * 空状态文案
	 */
	private getEmptyStateHTML(): string {
		return `<div class="text-center py-8 text-gray-500 dark:text-gray-400"><p>${i18n(I18nKey.tocEmpty)}</p></div>`;
	}

	/**
	 * 生成TOC HTML
	 */
	public generateTOCHTML(): string {
		const filteredHeadings = this.getFilteredHeadings();

		if (filteredHeadings.length === 0) {
			return this.getEmptyStateHTML();
		}

		let tocHTML = "";
		let heading1Count = 1;

		filteredHeadings.forEach((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			const depthLevel =
				depth === this.minDepth ? 0 : depth === this.minDepth + 1 ? 1 : 2;

			if (!heading.id) {
				return;
			}

			const badgeContent = this.generateBadgeContent(depth, heading1Count);
			if (depth === this.minDepth) {
				heading1Count++;
			}

			let headingText = this.getCleanTextContent(heading)
				.replace(/#+\s*$/, "")
				.trim();

			// Fallback for empty text (e.g. dynamic subtitle)
			if (!headingText) {
				const dataSubtitles = heading.getAttribute("data-subtitles");
				if (dataSubtitles) {
					try {
						const subtitles = JSON.parse(dataSubtitles);
						headingText = Array.isArray(subtitles) ? subtitles[0] : subtitles;
					} catch {
						// ignore
					}
				}
			}

			if (!headingText) {
				headingText =
					heading.id === "banner-subtitle"
						? "Banner Subtitle"
						: heading.id || "Heading";
			}

			const escapedHeadingText = this.escapeHtmlAttr(headingText);

			tocHTML += `
        <a 
          href="#${heading.id}" 
			  class="toc-item toc-level-${depthLevel}"
          data-heading-id="${heading.id}"
		  aria-label="${escapedHeadingText}"
		  title="${escapedHeadingText}"
        >
			  <div class="toc-badge ${depth === this.minDepth ? "toc-badge-index" : ""}">
            ${badgeContent}
          </div>
			  <div class="toc-label ${depth <= this.minDepth + 1 ? "toc-label-primary" : "toc-label-secondary"}">${headingText}</div>
        </a>
      `;
		});

		tocHTML += `<div id="${this.indicatorId}" style="opacity: 0;" class="toc-active-indicator"></div>`;

		return tocHTML;
	}

	/**
	 * 更新TOC内容
	 */
	public updateTOCContent(): void {
		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		tocContent.innerHTML = this.generateTOCHTML();
		this.tocContent = tocContent;
		this.tocContainer = tocContent.closest(".toc-scroll-container");
		this.indicator = document.getElementById(this.indicatorId);
		this.tocItems = Array.from(
			document.querySelectorAll(`#${this.contentId} a`),
		);
	}

	/**
	 * 获取当前应该激活的标题ID
	 */
	private getActiveHeadingIds(): string[] {
		const headings =
			this.headings.length > 0 ? this.headings : this.getFilteredHeadings();
		if (headings.length === 0) return [];

		let activeHeading: HTMLElement | null = null;
		let closestHeading: HTMLElement | null = null;
		let closestDistance = Number.POSITIVE_INFINITY;

		for (const heading of headings) {
			if (!heading.id) continue;

			const rect = heading.getBoundingClientRect();
			const activationY = this.getHeadingActivationY(heading);
			const distance = Math.abs(rect.top - activationY);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestHeading = heading;
			}

			if (rect.top <= activationY) {
				activeHeading = heading;
			} else {
				break;
			}
		}

		const selectedHeading = activeHeading ?? closestHeading;
		return selectedHeading?.id ? [selectedHeading.id] : [];
	}

	/**
	 * 更新活动状态
	 */
	public updateActiveState(): void {
		if (!this.tocItems || this.tocItems.length === 0) return;

		// 移除所有活动状态
		this.activeItems.forEach((item) => {
			item.classList.remove("visible");
		});

		const activeHeadingIds = this.getActiveHeadingIds();

		// 找到对应的TOC项并添加活动状态
		const activeItems = this.tocItems.filter((item) => {
			const headingId = item.dataset.headingId;
			return headingId && activeHeadingIds.includes(headingId);
		});

		// 添加活动状态
		activeItems.forEach((item) => {
			item.classList.add("visible");
		});
		this.activeItems = activeItems;

		// 更新活动指示器
		this.updateActiveIndicator(activeItems);
	}

	/**
	 * 更新活动指示器
	 */
	private updateActiveIndicator(activeItems: HTMLElement[]): void {
		const indicator =
			this.indicator ?? document.getElementById(this.indicatorId);
		if (!indicator || !this.tocItems.length) return;

		if (activeItems.length === 0) {
			if (indicator.style.opacity !== "0") {
				indicator.style.opacity = "0";
			}
			return;
		}

		const tocContent =
			this.tocContent ?? document.getElementById(this.contentId);
		if (!tocContent) return;

		const contentRect = tocContent.getBoundingClientRect();
		const firstActive = activeItems[0];
		const lastActive = activeItems[activeItems.length - 1];

		const firstRect = firstActive.getBoundingClientRect();
		const lastRect = lastActive.getBoundingClientRect();

		const top = firstRect.top - contentRect.top;
		const height = lastRect.bottom - firstRect.top;

		const nextTop = `${top}px`;
		const nextHeight = `${height}px`;
		if (indicator.style.top !== nextTop) {
			indicator.style.top = nextTop;
		}
		if (indicator.style.height !== nextHeight) {
			indicator.style.height = nextHeight;
		}
		if (indicator.style.opacity !== "1") {
			indicator.style.opacity = "1";
		}
	}

	/**
	 * 处理点击事件
	 */
	public handleClick(event: Event): void {
		event.preventDefault();
		const target = event.currentTarget as HTMLAnchorElement;
		const hrefId = target.getAttribute("href")?.substring(1) || "";
		const id = target.dataset.headingId || decodeURIComponent(hrefId);
		const targetElement = document.getElementById(id);

		if (targetElement) {
			this.scrollToHeading(targetElement);
		}
	}

	/**
	 * 设置IntersectionObserver
	 */
	public setupObserver(): void {
		const headings = this.getFilteredHeadings();
		this.activeItems = [];

		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver(
			() => {
				this.scheduleActiveUpdate();
			},
			{
				rootMargin: `-${this.scrollOffset}px 0px -70% 0px`,
				threshold: 0,
			},
		);

		headings.forEach((heading) => {
			if (heading.id) {
				this.observer?.observe(heading);
			}
		});
		this.setupHeadingMetricsMonitor();

		window.addEventListener("scroll", this.handleViewportChange, {
			passive: true,
		});
		window.addEventListener("resize", this.handleViewportChange);
	}

	/**
	 * 绑定点击事件
	 */
	public bindClickEvents(): void {
		this.tocItems.forEach((item) => {
			item.addEventListener("click", this.handleClick.bind(this));
		});
	}

	/**
	 * 清理
	 */
	public cleanup(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		if (this.pendingActiveUpdate !== null) {
			window.cancelAnimationFrame(this.pendingActiveUpdate);
			this.pendingActiveUpdate = null;
		}
		this.disconnectHeadingMetricsMonitor();
		window.removeEventListener("scroll", this.handleViewportChange);
		window.removeEventListener("resize", this.handleViewportChange);
		this.headings = [];
		this.activeItems = [];
		this.headingMetrics.clear();
		this.headingMetricsDirty = true;
		this.tocContent = null;
		this.tocContainer = null;
		this.indicator = null;
	}

	/**
	 * 初始化
	 */
	public init(): void {
		this.updateTOCContent();
		this.bindClickEvents();
		this.setupObserver();
		this.updateActiveState();
	}
}

/**
 * 检查是否为文章页面
 */
export function isPostPage(): boolean {
	return window.location.pathname.includes("/posts/");
}
