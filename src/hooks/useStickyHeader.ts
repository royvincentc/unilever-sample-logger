import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useStickyHeader(
  tableContainerRef: RefObject<HTMLDivElement | null>,
  theadRef: RefObject<HTMLTableSectionElement | null>
) {
  const clonedContainerRef = useRef<HTMLDivElement>(null);
  const clonedTheadRef = useRef<HTMLTableSectionElement>(null);
  
  const [showCloned, setShowCloned] = useState(false);
  const [containerStyle, setContainerStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const handleScroll = () => {
      if (!tableContainerRef.current || !theadRef.current) return;
      
      const rect = tableContainerRef.current.getBoundingClientRect();
      const headerOffset = 70;
      
      if (rect.top < headerOffset && rect.bottom > headerOffset + 100) {
        setShowCloned(true);
        
        setContainerStyle({
          left: rect.left,
          width: rect.width
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
    if (theadRef.current) {
      observer = new ResizeObserver(() => {
        handleScroll();
      });
    if (theadRef.current) observer.observe(theadRef.current);
    if (tableContainerRef.current) observer.observe(tableContainerRef.current);
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
