// Markdown Toolbar Functionality
// Provides formatting buttons and preview for the lore textarea

export function initializeMarkdownToolbar() {
    const loreTextarea = document.getElementById('lore');
    const markdownBtns = document.querySelectorAll('.markdown-btn');
    const previewBtn = document.getElementById('preview-lore-btn');
    const closePreviewBtn = document.getElementById('close-preview-btn');
    const previewPanel = document.getElementById('lore-preview');
    const previewContent = document.getElementById('lore-preview-content');

    if (!loreTextarea) return;

    // Markdown formatting functions
    const formats = {
        bold: (text) => `**${text || 'bold text'}**`,
        italic: (text) => `*${text || 'italic text'}*`,
        heading: (text) => `## ${text || 'Heading'}`,
        list: (text) => `- ${text || 'List item'}`,
        numbered: (text) => `1. ${text || 'Numbered item'}`,
        link: (text) => `[${text || 'link text'}](url)`,
        quote: (text) => `> ${text || 'Quote'}`,
        code: (text) => `\`\`\`\n${text || 'code'}\n\`\`\``
    };

    // Handle markdown button clicks
    markdownBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const format = btn.getAttribute('data-format');
            insertMarkdown(format);
        });
    });

    function insertMarkdown(format) {
        const start = loreTextarea.selectionStart;
        const end = loreTextarea.selectionEnd;
        const selectedText = loreTextarea.value.substring(start, end);
        const beforeText = loreTextarea.value.substring(0, start);
        const afterText = loreTextarea.value.substring(end);

        const formattedText = formats[format](selectedText);

        // For multi-line formats, add newlines
        if (format === 'heading' || format === 'list' || format === 'numbered' || format === 'quote' || format === 'code') {
            // If we're not at the start of a line, add a newline before
            const needsNewlineBefore = start > 0 && beforeText[beforeText.length - 1] !== '\n';
            // If there's text after and it doesn't start with newline, add one after
            const needsNewlineAfter = afterText.length > 0 && afterText[0] !== '\n';

            loreTextarea.value = 
                beforeText + 
                (needsNewlineBefore ? '\n' : '') + 
                formattedText + 
                (needsNewlineAfter ? '\n' : '') + 
                afterText;
        } else {
            loreTextarea.value = beforeText + formattedText + afterText;
        }

        // Set cursor position after the inserted text
        const newCursorPos = start + formattedText.length;
        loreTextarea.focus();
        loreTextarea.setSelectionRange(newCursorPos, newCursorPos);
    }

    // Preview functionality
    if (previewBtn && previewPanel && previewContent) {
        previewBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const markdownText = loreTextarea.value;

            if (!markdownText.trim()) {
                alert('Please write some content first!');
                return;
            }

            // Use the marked library (already loaded in quests.js)
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    pedantic: false,
                    smartLists: true,
                    smartypants: false
                });

                const html = marked.parse(markdownText);
                previewContent.innerHTML = html;

                // Style links in preview
                previewContent.querySelectorAll('a').forEach(link => {
                    link.classList.add('text-[#FFD700]', 'hover:underline', 'underline-offset-4', 'font-bold');
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                });

                // Style blockquotes
                previewContent.querySelectorAll('blockquote').forEach(quote => {
                    quote.classList.add('border-l-4', 'border-[#FFD700]/50', 'bg-black/20', 'p-4', 'my-4', 'rounded-r-lg', 'italic');
                });

                // Style lists
                previewContent.querySelectorAll('ul').forEach(ul => {
                    ul.classList.add('list-disc', 'ml-6', 'mb-4');
                });

                previewContent.querySelectorAll('ol').forEach(ol => {
                    ol.classList.add('list-decimal', 'ml-6', 'mb-4');
                });

                previewContent.querySelectorAll('li').forEach(li => {
                    li.classList.add('mb-1');
                });

                // Style code blocks
                previewContent.querySelectorAll('pre code').forEach(code => {
                    code.parentElement.classList.add('bg-black/40', 'p-4', 'rounded-lg', 'overflow-x-auto', 'my-4', 'border', 'border-gray-700');
                });

                // Show preview panel
                previewPanel.classList.remove('hidden');
            } else {
                // Fallback if marked isn't loaded
                previewContent.innerHTML = `<pre class="whitespace-pre-wrap">${markdownText}</pre>`;
                previewPanel.classList.remove('hidden');
            }
        });

        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                previewPanel.classList.add('hidden');
            });
        }
    }
}
