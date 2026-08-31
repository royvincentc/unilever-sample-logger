import re

def fix_livesheet():
    with open('src/pages/LiveSheetView.tsx', 'r') as f:
        content = f.read()

    # 1. Add phantomColWidths destructuring
    content = content.replace(
        "    containerStyle,\n    handleTableScroll",
        "    containerStyle,\n    colWidths: phantomColWidths,\n    handleTableScroll"
    )

    # 2. Add index to dynamicColumns map
    content = content.replace(
        "dynamicColumns.map((col) => {",
        "dynamicColumns.map((col, index) => {"
    )

    # 3. Add widths to phantom header __row
    parts = content.split("style={{ position: 'sticky', left: frozenLeftOffsets['__row'], zIndex: 30 }}")
    if len(parts) >= 3:
        content = parts[0] + "style={{ position: 'sticky', left: frozenLeftOffsets['__row'], zIndex: 30, ...(phantomColWidths[0] ? { width: phantomColWidths[0], minWidth: phantomColWidths[0], maxWidth: phantomColWidths[0], boxSizing: 'border-box' } : {}) }}" + parts[1] + "style={{ position: 'sticky', left: frozenLeftOffsets['__row'], zIndex: 30 }}" + parts[2]

    # 4. Add widths to phantom header dynamic columns
    parts = content.split("style={frozen ? { position: 'sticky', left: frozenLeftOffsets[col], zIndex: 30 } : {}}")
    if len(parts) >= 3:
        content = parts[0] + "style={{ ...(frozen ? { position: 'sticky', left: frozenLeftOffsets[col], zIndex: 30 } : {}), ...(phantomColWidths[index + 1] ? { width: phantomColWidths[index + 1], minWidth: phantomColWidths[index + 1], maxWidth: phantomColWidths[index + 1], boxSizing: 'border-box' } : {}) }}" + parts[1] + "style={frozen ? { position: 'sticky', left: frozenLeftOffsets[col], zIndex: 30 } : {}}" + parts[2]

    with open('src/pages/LiveSheetView.tsx', 'w') as f:
        f.write(content)

def fix_logbook():
    with open('src/pages/Logbook.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "    containerStyle,\n    handleTableScroll",
        "    containerStyle,\n    colWidths: phantomColWidths,\n    handleTableScroll"
    )

    parts = content.split("style={isControl ? { left: 0 } : {}}")
    if len(parts) >= 3:
        content = parts[0] + "style={{ ...(isControl ? { left: 0 } : {}), ...(phantomColWidths[i] ? { width: phantomColWidths[i], minWidth: phantomColWidths[i], maxWidth: phantomColWidths[i], boxSizing: 'border-box' } : {}) }}" + parts[1] + "style={isControl ? { left: 0 } : {}}" + parts[2]

    with open('src/pages/Logbook.tsx', 'w') as f:
        f.write(content)

def fix_results():
    with open('src/pages/Results.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "    containerStyle,\n    handleTableScroll",
        "    containerStyle,\n    colWidths: phantomColWidths,\n    handleTableScroll"
    )

    parts = content.split("style={isActions ? { left: 0 } : {}}")
    if len(parts) >= 3:
        content = parts[0] + "style={{ ...(isActions ? { left: 0 } : {}), ...(phantomColWidths[i] ? { width: phantomColWidths[i], minWidth: phantomColWidths[i], maxWidth: phantomColWidths[i], boxSizing: 'border-box' } : {}) }}" + parts[1] + "style={isActions ? { left: 0 } : {}}" + parts[2]

    with open('src/pages/Results.tsx', 'w') as f:
        f.write(content)

fix_livesheet()
fix_logbook()
fix_results()
