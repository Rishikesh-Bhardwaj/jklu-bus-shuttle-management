import React, { useState, useEffect } from 'react';

const CAMPUS_IMAGES = [
  {
    src: '/images/campus-1.png',
    alt: 'JKLU Campus - Academic Architecture and Lawn',
  },
  {
    src: '/images/campus-2.png',
    alt: 'JKLU Campus - Modern Administrative and Learning Center',
  },
  {
    src: '/images/campus-3.png',
    alt: 'JKLU Campus - University Pathways and Facilities',
  },
];

const SLIDE_INTERVAL_MS = 7000; // 7 seconds per slide

interface CampusSlideshowProps {
  className?: string;
}

export const CampusSlideshow: React.FC<CampusSlideshowProps> = ({ className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });

  // Listen to user's accessibility reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Automatic slide rotation (disabled if reduced-motion is requested)
  useEffect(() => {
    if (reducedMotion) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % CAMPUS_IMAGES.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none ${className}`}
    >
      {/* Slideshow Image Stack */}
      {CAMPUS_IMAGES.map((image, index) => {
        const isActive = reducedMotion ? index === 0 : index === currentIndex;
        return (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            className={`absolute inset-0 w-full h-full object-cover object-center ${
              reducedMotion
                ? index === 0
                  ? 'opacity-100'
                  : 'hidden'
                : `transition-opacity duration-1000 ease-in-out ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`
            }`}
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        );
      })}

      {/* Hero media scrim overlay matching Campus Market's directional depth gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40 backdrop-blur-[0.5px]" />
    </div>
  );
};

