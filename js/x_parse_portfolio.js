// ==UserScript==
// @name         X Parse Portfolio to Table
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Parse Google Finance portfolio clipboard to Table (Symbol, Value, %)
// @author       X
// @match        https://www.google.com/finance/*
// @icon         https://www.gstatic.com/finance/favicon/favicon.png
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/gh/zxux/republic@main/js/x_common.js
// @require      https://cdn.jsdelivr.net/gh/zxux/republic@main/js/x_parse_portfolio.js
// ==/UserScript==

// DEV: @require file:///<local-path>/x_common.js

(function() {
	'use strict';

	// ── Parser ───────────────────────────────────────────

	function preprocessClipboardText(text) {
		return text.split('\n').filter(line => line.trim() !== 'equalizer').join('\n');
	}

	function parseCurrencyAmount(value) {
		const normalized = value.replace(/[$,]/g, '');
		const [wholePart, fractionPart = ''] = normalized.split('.');
		const cents = (Number(wholePart) * 100) + Number((fractionPart + '00').slice(0, 2));
		return {
			rawValue: cents / 100,
			rawCents: cents,
		};
	}

	// Google Finance portfolio is a 7-line repeating block:
	// SYMBOL, NAME, PRICE, QUANTITY, CHANGE, PERCENT, TOTAL_VALUE
	function parsePortfolio(text) {
		const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
		const results = [];

		let i = 0;
		while (i < lines.length && /^(SYMBOL|NAME|PRICE|QUANTITY|VALUE)$/.test(lines[i])) i++;

		while (i + 6 < lines.length) {
			const symbol   = lines[i];
			const price    = lines[i + 2];
			const quantity = lines[i + 3];
			const total    = lines[i + 6];

			const valid = symbol && !symbol.startsWith('$') && !symbol.includes('%') && !/^[+-]\$/.test(symbol)
				&& price?.startsWith('$')
				&& /^[\d,.]+$/.test(quantity);

			if (valid) {
				const { rawValue, rawCents } = parseCurrencyAmount(total);
				results.push({
					symbol,
					rawValue,
					rawCents,
					value: Math.round(rawValue),
				});
				i += 7;
			} else {
				i++;
			}
		}

		const totalValue = results.reduce((sum, r) => sum + r.rawCents, 0);
		results.forEach(r => {
			r.pct = totalValue > 0 ? ((r.rawCents / totalValue) * 100).toFixed(2) : '0.00';
		});
		return results;
	}

	function toTable(data) {
		if (!data.length) return 'SYMBOL  VALUE  PERCENT';
		
		const rows = data.map(r => ({
			symbol: r.symbol,
			value: String(r.value),
			pct: r.pct + '%'
		}));
		
		const maxSymbol = Math.max('SYMBOL'.length, ...rows.map(r => r.symbol.length));
		const maxValue = Math.max('VALUE'.length, ...rows.map(r => r.value.length));
		
		const header = [
			'SYMBOL'.padEnd(maxSymbol),
			'VALUE'.padEnd(maxValue),
			'PERCENT'
		].join('  ');
		
		const lines = rows.map(r => {
			return [
				r.symbol.padEnd(maxSymbol),
				r.value.padEnd(maxValue),
				r.pct
			].join('  ');
		});
		
		return [header, ...lines].join('\n');
	}

	// ── Clipboard I/O ────────────────────────────────────

	function processText(text) {
		if (!text?.trim()) { showToast('Clipboard is empty'); return; }

		try {
			const processed = preprocessClipboardText(text);
			const data = parsePortfolio(processed);
			if (!data.length) { showToast('No valid data found'); return; }

			const table = toTable(data);
			GM_setClipboard(table, 'text');
			log(table);
			showToast(`Parsed ${data.length} entries to table`);
		} catch (e) {
			showToast(`Error: ${e.message}`);
		}
	}

	async function readClipboard() {
		if (navigator.clipboard?.readText) {
			try {
				const text = await navigator.clipboard.readText();
				if (text?.trim()) {
					processText(text);
					return;
				}
			} catch (e) {
				log(`Clipboard API unavailable: ${e.message}`);
			}
		}

		showManualPasteDialog();
	}

	function showManualPasteDialog() {
		showToast('Please paste manually');

		const overlay = document.createElement('div');
		overlay.style.cssText = `
			position:fixed; inset:0; z-index:999998;
			background:rgba(0,0,0,0.3);
		`;

		const ta = document.createElement('textarea');
		ta.style.cssText = `
			position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
			width:400px; height:300px; padding:10px; border:2px solid #4CAF50;
			border-radius:8px; z-index:999999; background:#fff; font-size:14px;
		`;
		ta.placeholder = 'Paste portfolio data here, then Ctrl+Enter...';

		const dismiss = () => {
			overlay.remove();
			ta.remove();
		};

		overlay.addEventListener('click', dismiss);

		ta.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				const text = ta.value;
				dismiss();
				processText(text);
			} else if (e.key === 'Escape') {
				dismiss();
			}
		});

		document.body.appendChild(overlay);
		document.body.appendChild(ta);
		ta.focus();
	}

	// ── Entry Point ──────────────────────────────────────

	function hideEqualizerIcons(root = document) {
		const icons = root.querySelectorAll('i.google-material-icons');
		for (const icon of icons) {
			if (icon.textContent.trim() === 'equalizer') {
				icon.style.display = 'none';
			}
		}
	}

	function main() {
		if (window.top !== window.self) return;
		GM_registerMenuCommand("Parse Portfolio to Table", readClipboard);
		
		hideEqualizerIcons();
		const observer = new MutationObserver(() => hideEqualizerIcons());
		observer.observe(document.body, { childList: true, subtree: true });
	}

	main();
})();
