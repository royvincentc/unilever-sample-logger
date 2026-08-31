import sys

def main():
    try:
        with open('src/pages/Logbook.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # 1. Add isRoy definition
    target1 = "export default function Logbook() {\n  const { theme, setTheme } = useTheme();"
    replacement1 = "export default function Logbook() {\n  const { theme, setTheme } = useTheme();\n  const isRoy = getUserName().toLowerCase() === 'roy';"
    content = content.replace(target1, replacement1)

    # 2. Fix listenToLogbookSettings
    target2 = '''    const unsubscribe = listenToLogbookSettings((settings) => {
      if (settings) {
        if (settings.hiddenColumns) {
          setHiddenColumns(new Set(settings.hiddenColumns));
          localStorage.setItem('logbook_hiddenColumns', JSON.stringify(settings.hiddenColumns));
        }
        if (settings.columnOrder) {
          setColumnOrder(settings.columnOrder);
          localStorage.setItem('logbook_columnOrder', JSON.stringify(settings.columnOrder));
        }
      } else if (!initialized) {
        // No global settings exist yet. Push local settings to become the global default.
        const localHiddenStr = localStorage.getItem('logbook_hiddenColumns');
        const localOrderStr = localStorage.getItem('logbook_columnOrder');
        
        let initialHidden: string[] = [];
        let initialOrder: string[] = [];
        try { if(localHiddenStr) initialHidden = JSON.parse(localHiddenStr); } catch(e){}
        try { if(localOrderStr) initialOrder = JSON.parse(localOrderStr); } catch(e){}
        
        if (initialHidden.length > 0 || initialOrder.length > 0) {
           saveLogbookSettings({
             hiddenColumns: initialHidden,
             columnOrder: initialOrder
           }).catch(console.error);
        }
      }
      initialized = true;
    });'''
    
    replacement2 = '''    const unsubscribe = listenToLogbookSettings((settings) => {
      if (settings) {
        if (settings.hiddenColumns) {
          setHiddenColumns(new Set(settings.hiddenColumns));
          localStorage.setItem('logbook_hiddenColumns', JSON.stringify(settings.hiddenColumns));
        }
        if (settings.columnOrder) {
          setColumnOrder(settings.columnOrder);
          localStorage.setItem('logbook_columnOrder', JSON.stringify(settings.columnOrder));
        }
      } else if (!initialized) {
        // No global settings exist yet.
        if (isRoy) {
          // Push local settings to become the global default.
          const localHiddenStr = localStorage.getItem('logbook_hiddenColumns');
          const localOrderStr = localStorage.getItem('logbook_columnOrder');
          
          let initialHidden: string[] = [];
          let initialOrder: string[] = [];
          try { if(localHiddenStr) initialHidden = JSON.parse(localHiddenStr); } catch(e){}
          try { if(localOrderStr) initialOrder = JSON.parse(localOrderStr); } catch(e){}
          
          if (initialHidden.length > 0 || initialOrder.length > 0) {
             saveLogbookSettings({
               hiddenColumns: initialHidden,
               columnOrder: initialOrder
             }).catch(console.error);
          }
        }
      }
      initialized = true;
    });'''
    content = content.replace(target2, replacement2)

    # 3. Handle drag events
    target3_start = "const handleDragStart = (e: React.DragEvent, col: string) => {\n    setDraggedColumn(col);"
    repl3_start = "const handleDragStart = (e: React.DragEvent, col: string) => {\n    if (!isRoy) return;\n    setDraggedColumn(col);"
    content = content.replace(target3_start, repl3_start)

    target3_drop = "const handleDrop = (e: React.DragEvent, targetCol: string) => {\n    e.preventDefault();\n    if (!draggedColumn || draggedColumn === targetCol) return;"
    repl3_drop = "const handleDrop = (e: React.DragEvent, targetCol: string) => {\n    e.preventDefault();\n    if (!isRoy || !draggedColumn || draggedColumn === targetCol) return;"
    content = content.replace(target3_drop, repl3_drop)

    # 4. Hide "Columns" dropdown if not Roy
    # The button starts with <div className="relative" ref={colDropdownRef}>
    # and ends with </div> just before the <div className="w-full overflow-x-auto ...">
    # Let's just wrap the whole relative div.
    
    target4_start = "<div className=\"relative\" ref={colDropdownRef}>"
    repl4_start = "{isRoy && (\n            <div className=\"relative\" ref={colDropdownRef}>"
    content = content.replace(target4_start, repl4_start)

    target4_end = '''                    </motion.div>
                )}
              </AnimatePresence>
            </div>'''
    repl4_end = '''                    </motion.div>
                )}
              </AnimatePresence>
            </div>\n            )}'''
    content = content.replace(target4_end, repl4_end)

    with open('src/pages/Logbook.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Modifications applied successfully.")

if __name__ == '__main__':
    main()
