with open('src/pages/Results.tsx', 'r') as f:
    content = f.read()

# Actions column
content = content.replace(
    "<th className=\"px-3 py-2 font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] uppercase tracking-wider text-[10px]\">Actions</th>",
    "<th style={{ ...(phantomColWidths[0] ? { width: phantomColWidths[0], minWidth: phantomColWidths[0], maxWidth: phantomColWidths[0], boxSizing: 'border-box' } : {}) }} className=\"px-3 py-2 font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] uppercase tracking-wider text-[10px]\">Actions</th>"
)

# mapped columns
parts = content.split("className=\"px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group\"")
if len(parts) >= 3:
    content = parts[0] + "className=\"px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group\"\n                            style={{ ...(phantomColWidths[i + 1] ? { width: phantomColWidths[i + 1], minWidth: phantomColWidths[i + 1], maxWidth: phantomColWidths[i + 1], boxSizing: 'border-box' } : {}) }}" + parts[1] + "className=\"px-3 py-2 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none transition-colors group\"" + parts[2]

with open('src/pages/Results.tsx', 'w') as f:
    f.write(content)
