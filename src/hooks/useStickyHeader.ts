import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useStickyHeader(
  tableContainerRef: RefObject<HTMLDivElement | null>,
  theadRef: RefObject<HTMLTableSectionElement | null>
) {
  const clonedContainerRef = useRef<HTMLDivElement>(null);
  const clonedTheadRef = useRef<HTMLTableSectionElement>(null);
  
  const [showCloned, setShowCloned] = useState(false);
  const [containerStyle, setContainerStyle] = useState({ left: 0, width: 0, tableWidth: 0 });

  useEffect(() => {
    const handleScroll = () => {
      if (!tableContainerRef.current || !theadRef.current) return;
      
      const rect = tableContainerRef.current.getBoundingClientRect();
      const headerOffset = 70; // Height of the top nav
      
      if (rect.top < headerOffset && rect.bottom > headerOffset + 100) {
        setShowCloned(true);
        
        const tableEl = tableContainerRef.current.querySelector('table');
        const tableWidth = tableEl ? tableEl.getBoundingClientRect().width : rect.width;

        setContainerStyle({
          left: rect.left,
          width: rect.width,
          tableWidth
        });
        
        if (clonedTheadRef.current) {
          const originalThs = Array.from(theadRef.current.querySelectorAll('th'));
          const clonedThs = Array.from(clonedTheadRef.current.querySelectorAll('th'));
          
          originalThs.forEach((th, i) => {
            if (clonedThs[i]) {
              const width = th.getBoundingClientRect().width;
              clonedThs[i].style.minWidth = `${width}px`;
              clonedThs[i].style.maxWidth = `${width}px`;
              clonedThs[i].style.width = `${width}px`;
              // Force box-sizing to border-box so padding/borders are included in width
              clonedThs[i].style.boxSizing = 'border-box';
            }
          });
        }
        
        if (clonedContainerRef.current) {
          clonedContainerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
        }
        
      } else {
        setShowCloned(false);
      }
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
    };
  }, [tableContainerRef, theadRef]);

  const handleTableScroll = () => {
    if (tableContainerRef.current && clonedContainerRef.current) {
      clonedContainerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  return {
    clonedContainerRef,
    clonedTheadRef,
    showCloned,
    containerStyle,
    handleTableScroll
  };
}
