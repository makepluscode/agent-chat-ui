"use client";

import { useEffect } from "react";

export function DevtoolsReplacer() {
  useEffect(() => {
    const removeDevtoolsIndicator = () => {
      // 모든 요소를 검사
      const allElements = document.querySelectorAll('*');
      const toRemove: HTMLElement[] = [];

      allElements.forEach((element) => {
        const el = element as HTMLElement;
        if (!el || !el.getBoundingClientRect) return;

        try {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const text = el.textContent?.trim() || '';
          
          // 화면 하단에 고정된 작은 요소 찾기
          const isBottomFixed = 
            (style.position === 'fixed' || style.position === 'absolute') &&
            rect.bottom > window.innerHeight - 100 &&
            rect.bottom < window.innerHeight + 50 &&
            rect.width < 200 &&
            rect.height < 200;

          // N 버튼 조건 확인
          const hasN = 
            text === 'N' || 
            text === 'Next' || 
            (text.length <= 10 && (text.includes('N') || text.includes('next'))) ||
            el.getAttribute('aria-label')?.toLowerCase().includes('next') ||
            el.getAttribute('href')?.includes('next');

          // SVG가 있는 작은 버튼 (Next.js 로고)
          const hasNextSvg = el.querySelector('svg') && 
                             (rect.width < 100 && rect.height < 100);

          // data 속성 확인
          const hasNextData = 
            el.hasAttribute('data-next-mark-loading') ||
            el.className?.toString().includes('next') ||
            el.id?.includes('next');

          if (isBottomFixed && (hasN || hasNextSvg || hasNextData)) {
            toRemove.push(el);
          }
        } catch (e) {
          // 에러 무시
        }
      });

      // 찾은 요소들을 완전히 제거
      toRemove.forEach((el) => {
        try {
          // 부모에서 완전히 제거
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          } else {
            el.remove();
          }
        } catch (e) {
          // 제거 실패 시 최소한 숨기기
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.style.position = 'absolute';
          el.style.left = '-9999px';
          el.style.top = '-9999px';
          el.style.width = '0';
          el.style.height = '0';
        }
      });
    };

    // 즉시 실행
    removeDevtoolsIndicator();

    // 짧은 간격으로 여러 번 실행 (Next.js가 늦게 추가할 수 있음)
    const intervals = [
      setTimeout(removeDevtoolsIndicator, 50),
      setTimeout(removeDevtoolsIndicator, 100),
      setTimeout(removeDevtoolsIndicator, 200),
      setTimeout(removeDevtoolsIndicator, 500),
      setTimeout(removeDevtoolsIndicator, 1000),
      setTimeout(removeDevtoolsIndicator, 2000),
      setTimeout(removeDevtoolsIndicator, 3000),
      setTimeout(removeDevtoolsIndicator, 5000),
    ];

    // MutationObserver로 동적으로 추가되는 요소 즉시 감지 및 제거
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            // 새로 추가된 요소와 그 자식들 모두 확인
            const allNew = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[];
            allNew.forEach((newEl) => {
              if (!newEl.getBoundingClientRect) return;
              try {
                const rect = newEl.getBoundingClientRect();
                const style = getComputedStyle(newEl);
                const text = newEl.textContent?.trim() || '';
                
                const isBottomFixed = 
                  (style.position === 'fixed' || style.position === 'absolute') &&
                  rect.bottom > window.innerHeight - 100 &&
                  rect.bottom < window.innerHeight + 50;

                const hasN = 
                  text === 'N' || 
                  text === 'Next' || 
                  (text.length <= 10 && text.includes('N')) ||
                  newEl.getAttribute('aria-label')?.toLowerCase().includes('next') ||
                  newEl.hasAttribute('data-next-mark-loading');

                if (isBottomFixed && hasN) {
                  if (newEl.parentNode) {
                    newEl.parentNode.removeChild(newEl);
                  } else {
                    newEl.remove();
                  }
                }
              } catch (e) {}
            });
          }
        });
      });
      // 추가로 전체 검사
      removeDevtoolsIndicator();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-next-mark-loading'],
    });

    // 주기적으로도 체크 (매우 자주)
    const mainInterval = setInterval(removeDevtoolsIndicator, 100);

    return () => {
      observer.disconnect();
      clearInterval(mainInterval);
      intervals.forEach(clearTimeout);
    };
  }, []);

  return null;
}
