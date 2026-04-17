// ==UserScript==
// @name         X Copy MarkDown
// @namespace    https://gist.github.com/vhxubo/e94b0cceadf0291050f05ab1c0bb19c9
// @homepage     https://gist.github.com/vhxubo/e94b0cceadf0291050f05ab1c0bb19c9
// @version      0.7
// @description  Copy page title & URL in various formats (Markdown, Rich, Plain)
// @author       X
// @match        http://*/*
// @match        https://*/*
// @icon         https://cdn.iconscout.com/icon/free/png-128/markdown-486861-2364930.png
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/gh/zxux/republic@main/js/x_common.js
// @require      https://cdn.jsdelivr.net/gh/zxux/republic@main/js/x_copy_markdown.js
// ==/UserScript==

// DEV: @require file:///<local-path>/x_common.js
// DEV: @require file:///<local-path>/x_copy_markdown.js

// ── Format Definitions ──────────────────────────────────

const FORMAT = {
	MARKDOWN:   "MarkDown",
	TITLE_ONLY: "TitleOnly",
	URL_ONLY:   "UrlOnly",
	TITLE_URL:  "TitleUrl",
	RICH_TITLE: "RichTitle",
};

// ── Copy Logic ───────────────────────────────────────────

function getSiteName(url) {
	let hostname = new URL(url).hostname.replace(/^www\./, '');
	return hostname.split('.')[0];
}

function copyAs(format) {
	const title = document.title;
	const url = document.URL;
	const site = getSiteName(url);
	let text = "";

	switch (format) {
		case FORMAT.MARKDOWN:
			text = (title.search("[|-]") === -1)
				? `[${title} - ${site}](${url})`
				: `[${title}](${url})`;
			GM_setClipboard(text);
			break;

		case FORMAT.TITLE_ONLY:
			text = title;
			GM_setClipboard(text, 'text');
			break;

		case FORMAT.URL_ONLY:
			text = url;
			GM_setClipboard(text, 'text');
			break;

		case FORMAT.RICH_TITLE:
			const link = document.createElement('a');
			link.href = url;
			link.textContent = title;
			GM_setClipboard(link.outerHTML, 'html');
			text = `//  ${title}  //`;
			break;

		case FORMAT.TITLE_URL:
			text = `${title} - ${url}`;
			GM_setClipboard(text);
			break;
	}

	showToast(text);
}

// ── Popup Menu ───────────────────────────────────────────

function createCopyMenu() {
	const items = [
		['Markdown link', FORMAT.MARKDOWN],
		['Rich link', FORMAT.RICH_TITLE],
		['Title and URL', FORMAT.TITLE_URL],
		['Title only', FORMAT.TITLE_ONLY],
		['URL only', FORMAT.URL_ONLY],
	];
	let dialog;

	function show() {
		if (dialog) return;
		const host = document.createElement('div');
		host.style.setProperty('all', 'initial', 'important');
		const root = host.attachShadow({ mode: 'closed' });
		root.innerHTML = `
			<style>
				dialog {
					color-scheme: light dark;
					box-sizing: border-box; width: min(340px, calc(100vw - 32px));
					max-height: calc(100dvh - 32px); overflow: auto;
					font: 14px/1.4 system-ui, sans-serif; direction: ltr;
					letter-spacing: normal; text-transform: none; text-align: left;
					color: CanvasText; background: Canvas; padding: 8px;
					border: 1px solid color-mix(in srgb, CanvasText 16%, Canvas);
					border-radius: 16px; box-shadow: 0 12px 44px #0003;
				}
				dialog::backdrop { background: rgb(20 25 34 / 16%); }
				h2 { margin: 0; padding: 10px 12px 12px; font: 650 15px/1.4 system-ui, sans-serif; }
				button {
					display: flex; align-items: center; justify-content: space-between; gap: 8px;
					width: 100%; padding: 10px 12px; min-height: 40px; border: 0;
					border-radius: 8px; background: transparent; color: inherit;
					font: inherit; text-align: left; cursor: pointer;
				}
				button:hover, button:focus { background: color-mix(in srgb, Highlight 11%, Canvas); }
				button:focus-visible { outline: 2px solid Highlight; outline-offset: -2px; }
				kbd { font: 11px/1.5 system-ui, sans-serif; border: 1px solid GrayText; border-radius: 5px; padding: 0 5px; }
			</style>
			<dialog aria-labelledby="copy-heading"><h2 id="copy-heading">Copy format</h2></dialog>
		`;
		dialog = root.querySelector('dialog');
		const buttons = items.map(([label, format]) => {
			const button = document.createElement('button');
			button.textContent = label;
			if (format === FORMAT.MARKDOWN) {
				const key = document.createElement('kbd');
				key.textContent = 'Ctrl ⇧ K';
				button.append(key);
			}
			button.onclick = () => { dialog.close(); copyAs(format); };
			dialog.append(button);
			return button;
		});
		dialog.onkeydown = (event) => {
			event.stopPropagation();
			const direction = { ArrowDown: 1, ArrowUp: -1 }[event.key];
			if (direction) {
				event.preventDefault();
				const index = buttons.indexOf(root.activeElement);
				buttons[(index + direction + buttons.length) % buttons.length].focus();
			} else if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				buttons[0].click();
			}
		};
		dialog.onclick = (event) => {
			if (event.target !== dialog) return;
			const rect = dialog.getBoundingClientRect();
			if (event.clientX < rect.left || event.clientX > rect.right ||
				event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
		};
		dialog.onclose = () => { host.remove(); dialog = null; };
		document.documentElement.append(host);
		dialog.showModal();
	}
	return { show };
}

// ── Entry Point ──────────────────────────────────────────

function main() {
	if (window.top !== window.self) return;

	const menu = createCopyMenu();
	const isEditable = (target) => {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;

		const tag = target.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
		if (tag === 'SELECT' || tag === 'OPTION' || tag === 'BUTTON') return true;

		return target.closest('[role="textbox"]') !== null;
	};

	const matchShortcut = (e, combo) => {
		if (!e.key) return false;
		return (
			e.ctrlKey === combo.ctrl &&
			e.altKey === combo.alt &&
			e.shiftKey === combo.shift &&
			!e.metaKey &&
			e.key.toLowerCase() === combo.key
		);
	};

	const shortcuts = {
		menu:   { ctrl: true, alt: false, shift: true, key: "m" },
		markdown: { ctrl: true, alt: false, shift: true, key: "k" },
	};

	GM_registerMenuCommand("MarkDown [Title](URL)", () => copyAs(FORMAT.MARKDOWN));
	GM_registerMenuCommand("Rich Title (HTML)",     () => copyAs(FORMAT.RICH_TITLE));
	GM_registerMenuCommand("Title with URL",        () => copyAs(FORMAT.TITLE_URL));
	GM_registerMenuCommand("Only Plain Title",      () => copyAs(FORMAT.TITLE_ONLY));

	document.addEventListener("keydown", (e) => {
		if (isEditable(e.target)) return;

		if (matchShortcut(e, shortcuts.menu)) {
			e.preventDefault();
			menu.show();
			return;
		}
		if (matchShortcut(e, shortcuts.markdown)) copyAs(FORMAT.MARKDOWN);
	});
}
