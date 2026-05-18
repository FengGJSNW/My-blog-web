import type { ProfileConfig } from "../types/config";

export const profileConfig: ProfileConfig = {
	// 澶村儚
	// 鍥剧墖璺緞鏀寔涓夌鏍煎紡锛?
	// 1. public 鐩綍锛堜互 "/" 寮€澶达紝涓嶄紭鍖栵級锛?/assets/images/avatar.webp"
	// 2. src 鐩綍锛堜笉浠?"/" 寮€澶达紝鑷姩浼樺寲浣嗕細澧炲姞鏋勫缓鏃堕棿锛屾帹鑽愶級锛?assets/images/avatar.webp"
	// 3. 杩滅▼ URL锛?https://example.com/avatar.jpg"
	avatar: "/assets/images/avatar.webp?v=20260106",

	// 鍚嶅瓧
	name: "Feng_GJSNW",

	// 涓汉绛惧悕
	bio: "Olah!!! 我是Feng_GJSNW",

	// 閾炬帴閰嶇疆
	// 宸茬粡棰勮鐨勫浘鏍囬泦锛歠a7-brands锛宖a7-regular锛宖a7-solid锛宮aterial-symbols锛宻imple-icons
	// 璁块棶https://icones.js.org/ 鑾峰彇鍥炬爣浠ｇ爜锛?
	// 濡傛灉鎯充娇鐢ㄥ皻鏈寘鍚浉搴旂殑鍥炬爣闆嗭紝鍒欓渶瑕佸畨瑁呭畠
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 鏃舵樉绀哄浘鏍囧拰鍚嶇О锛宖alse 鏃跺彧鏄剧ず鍥炬爣
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/FengGJSNW",
			showName: true,
		},
		{
			name: "Email",
			icon: "fa7-solid:envelope",
			url: "mailto:xiaye@msn.com",
			showName: true,
		},
	],
};
