import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.join(__dirname, '../document/FRONTEND_BACKEND_HOSTING_AND_MULTIDB_GUIDE.md');
const htmlPath = path.join(__dirname, 'guide.html');
const pdfPath = path.join(__dirname, '../document/FRONTEND_BACKEND_HOSTING_AND_MULTIDB_GUIDE.pdf');

const mdContent = fs.readFileSync(mdPath, 'utf8');

// Basic Markdown to HTML converter
function markdownToHtml(md) {
  let html = md
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '3<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '4<h4>$1</h4>')
    .replace(/3<h3>/g, '<h3>')
    .replace(/4<h4>/g, '<h4>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^---$/gim, '<hr/>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre><code>${p1.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });

  // Wrap lists
  html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Paragraphs
  const lines = html.split('\n\n');
  const formatted = lines.map(line => {
    if (line.trim().startsWith('<h') || line.trim().startsWith('<pre') || line.trim().startsWith('<ul') || line.trim().startsWith('<hr')) {
      return line;
    }
    return `<p>${line}</p>`;
  }).join('\n');

  return formatted;
}

const bodyHtml = markdownToHtml(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PublicSpark Deployment & Multi-DB Guide</title>
  <style>
    @page {
      margin: 1.5cm;
      size: A4;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #ffffff;
      padding: 2rem;
      font-size: 14px;
    }
    h1 {
      color: #991b1b;
      border-bottom: 3px solid #dc2626;
      padding-bottom: 0.5rem;
      font-size: 24px;
      margin-top: 0;
    }
    h2 {
      color: #1e3a8a;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.3rem;
      margin-top: 1.8rem;
      font-size: 18px;
    }
    h3 {
      color: #065f46;
      font-size: 15px;
      margin-top: 1.2rem;
    }
    code {
      font-family: "JetBrains Mono", Consolas, Monaco, monospace;
      background-color: #f3f4f6;
      color: #991b1b;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 12px;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
    }
    pre code {
      background-color: transparent;
      color: #f8fafc;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 0.6rem 0.8rem;
      text-align: left;
      font-size: 13px;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 700;
      color: #111827;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      background-color: #eff6ff;
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      color: #1e40af;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2rem 0;
    }
    ul, ol {
      padding-left: 1.5rem;
    }
    li {
      margin-bottom: 0.4rem;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf8');

console.log('HTML file created:', htmlPath);

// Execute Microsoft Edge Headless PDF generator
const edgePath = `"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"`;
const cmd = `${edgePath} --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;

try {
  execSync(cmd);
  console.log('Successfully generated PDF at:', pdfPath);
} catch (err) {
  console.error('Error generating PDF via Edge:', err.message);
}
