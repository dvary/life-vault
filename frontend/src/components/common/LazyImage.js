import React, { useState, useRef, useEffect } from 'react';

const LazyImage = ({ src, alt, className, placeholder, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div ref={imgRef} className={className} {...props}>
      {isInView && (
        <>
          {!isLoaded && placeholder && (
            <div className="absolute inset-0 flex items-center justify-center liquid-glass-subtle">
              {placeholder}
            </div>
          )}
          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            className={`transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </>
      )}
    </div>
  );
};

export default LazyImage;
