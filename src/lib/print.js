import { escapeHtml } from "./text";

function buildMinutesBody(content) {
  const esc = escapeHtml;
  let body = "";
  let headerLines = [];
  let inHeader = true;
  let titleDone = false;
  let inList = false;
  let inOther = false;
  const closeList = () => { if (inList) { body += "</ul>\n"; inList = false; } };
  for (const line of content.split("\n")) {
    const t = line.trim();
    // Title: first non-empty line (handles both "# タイトル" and plain "タイトル")
    if (!titleDone && inHeader && t && t !== "---") {
      const titleText = t.startsWith("# ") ? t.slice(2) : t;
      body += `<h1 class="title">${esc(titleText)}</h1>\n`;
      titleDone = true;
      continue;
    }
    if (inHeader) {
      if (t === "---") {
        if (headerLines.length) {
          body += "<table class='meta'>" + headerLines.map(l => {
            if (!l.trim()) return "";
            const isCont = l.charAt(0) === "　" || l.charAt(0) === " ";
            const ci = l.indexOf("：");
            if (!isCont && ci > 0) return `<tr><td class="mk">${esc(l.slice(0, ci + 1).trim())}</td><td class="mv">${esc(l.slice(ci + 1).trim())}</td></tr>`;
            return `<tr><td class="mk"></td><td class="mv">${esc(l.trim())}</td></tr>`;
          }).join("") + "</table>";
        }
        body += `<hr class="div">`;
        inHeader = false;
      } else if (t) { headerLines.push(line); }
      continue;
    }
    if (t === "---") { closeList(); body += `<hr class="div">`; continue; }
    if (t === "[改ページ]") { closeList(); body += `<div class="pb"></div>`; continue; }
    // Section headers: "### ■ ..." (旧形式) or "■ ..." (新形式)
    if (t.startsWith("### ") || (t.startsWith("■ ") && !t.match(/^■\s*$/))) {
      closeList();
      inOther = t.includes("その他") || t.includes("備考");
      const label = t.startsWith("### ") ? t.slice(4) : t;
      const isAgenda = /■\s*議題/.test(label);
      if (isAgenda) {
        body += `<h2 class="sh" style="background:#F0F0F0;padding:8px 12px;border-radius:0;box-shadow:none;font-weight:bold;margin-bottom:8px;">${esc(label)}</h2>\n`;
      } else {
        body += `<h2 class="sh">${esc(label)}</h2>\n`;
      }
      continue;
    }
    // Subheaders: "* **【...】**" (旧形式) or "【...】" alone (新形式)
    if (t.match(/^\*+\s+\*\*【.+】\*\*/)) {
      closeList();
      const label = t.replace(/^\*+\s+\*\*/, "").replace(/\*\*$/, "");
      body += `<div class="subh">${esc(label)}</div>\n`;
      continue;
    }
    if (t.match(/^【.+】$/) && !t.includes("：")) {
      closeList();
      body += `<div class="subh">${esc(t)}</div>\n`;
      continue;
    }
    // Bullet items: "* ..." (旧形式) or "・..." (新形式)
    if (t.match(/^\*+\s+/) || t.startsWith("・")) {
      if (!inList) { body += `<ul class="ul">\n`; inList = true; }
      let c2 = t.startsWith("・") ? t.slice(1) : t.replace(/^\*+\s+/, "");
      c2 = c2.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      body += `<li>${esc(c2).replace(/&lt;strong&gt;/g, "<strong>").replace(/&lt;\/strong&gt;/g, "</strong>")}</li>\n`;
      continue;
    }
    if (!t) { closeList(); continue; }
    closeList();
    const pText = t;
    body += `<p class="p">${esc(pText)}</p>\n`;
  }
  closeList();
  return body;
}

function buildAgendaBody(content) {
  return buildMinutesBody(content);
}

function highlightInHtml(html, keyword) {
  if (!keyword || !keyword.trim()) return html;
  const esc = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = html.split(/(<[^>]+>)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(new RegExp(`(${esc})`, 'gi'),
      '<mark style="background-color:#FFF176;color:#000;border-radius:2px;padding:0 2px">$1</mark>');
  }).join('');
}

const PREVIEW_CSS = `
  .mins-preview { font-family: 'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif; font-size: 13px; color: #2D2A24; line-height: 1.75; }
  .mins-preview .title { font-size: 15px; font-weight: 700; text-align: left; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #2D2A24; letter-spacing: 0.05em; }
  .mins-preview table.meta { border-collapse: collapse; margin-bottom: 10px; }
  .mins-preview .mk { font-size: 12px; font-weight: 700; padding: 2px 14px 2px 0; white-space: nowrap; vertical-align: top; }
  .mins-preview .mv { font-size: 12px; padding: 2px 0; vertical-align: top; }
  .mins-preview .div { border: none; border-top: 1px solid #aaa; margin: 10px 0; }
  .mins-preview .sh { font-size: 13px; font-weight: 700; margin: 18px 0 8px; padding: 4px 0; border-bottom: 1px solid #2D2A24; }
  .mins-preview .subh { font-size: 12px; font-weight: 700; margin: 10px 0 4px; }
  .mins-preview .ul { padding-left: 0; margin: 4px 0 8px; list-style: none; }
  .mins-preview .ul li { margin: 3px 0; font-size: 12px; line-height: 1.7; padding-left: 1.2em; text-indent: -1.2em; }
  .mins-preview .ul li::before { content: "・"; }
  .mins-preview .p { font-size: 12px; margin: 3px 0 6px; line-height: 1.7; }
  .mins-preview .tt { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 12px; }
  .mins-preview .tt th { background: #f0f0f0; border: 1px solid #999; padding: 6px 10px; text-align: left; font-weight: 700; }
  .mins-preview .tt td { padding: 6px 10px; border: 1px solid #ccc; vertical-align: top; line-height: 1.6; }
`;


export { buildMinutesBody, buildAgendaBody, highlightInHtml, PREVIEW_CSS };
