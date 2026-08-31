import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';

export function useStickyHeader(
  tableContainerRef: RefObject<HTMLDivElement | null>,
  theadRef: RefObject<HTMLTableSectionElement | null>
) {
  const clonedContainerRef = useRef<HTMLDivElement>(null);
  const clonedTheadRef = useRef<HTMLTableSectionElement>(null);
  
  const [showCloned, setShowCloned] = useState(false);
  const [containerStyle, setContainerStyle] = useState({ left: 0, width: 0, tableWidth: 0 });
  const [colWidths, setColWidths] = useState<number[]>([]);

  // rAF guard to prevent running more than once per frame
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      // Throttle via requestAnimationFrame — at most one update per frame
      if (rafId.current !== null) return;

      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;

        if (!tableContainerRef.current || !theadRef.current) return;
        
        const rect = tableContainerRef.current.getBoundingClientRect();
        const headerOffset = 0; // No fixed top nav
        
        if (rect.top < headerOffset && rect.bottom > headerOffset + 100) {
          setShowCloned(true);
          
          const tableEl = tableContainerRef.current.querySelector('table');
          const tableWidth = tableEl ? tableEl.getBoundingClientRect().width : rect.width;

          setContainerStyle({
            left: rect.left,
            width: rect.width,
            tableWidth
          });
          
          const originalThs = Array.from(theadRef.current!.querySelectorAll('th'));
          const newWidths = originalThs.map(th => th.getBoundingClientRect().width);
          
          setColWidths(prev => {
            if (prev.length !== newWidths.length || prev.some((w, i) => Math.abs(w - newWidths[i]) > 0.5)) {
              return newWidths;
            }
            return prev;
          });
          
          if (clonedContainerRef.current) {
            clonedContainerRef.current.scrollLeft = tableContainerRef.current!.scrollLeft;
          }
          
        } else {
          setShowCloned(false);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    
    let observer: ResizeObserver | null = null;
    if (theadRef.current && tableContainerRef.current) {
      observer = new ResizeObserver(() => {
        handleScroll();
      });
      observer.observe(theadRef.current);
      observer.observe(tableContainerRef.current);
    }
    
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (observer) {
        observer.disconnect();
      }
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [tableContainerRef, theadRef]);

  const handleTableScroll = useCallback(() => {
    if (tableContainerRef.current && clonedContainerRef.current) {
      clonedContainerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  }, [tableContainerRef]);

  return {
    clonedContainerRef,
    clonedTheadRef,
    showCloned,
    containerStyle,
    colWidths,
    handleTableScroll
  };
}
