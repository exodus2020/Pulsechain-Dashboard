import React, { useState, useEffect } from "react";

const LoadingWave = ({ speed = 500, numDots = 10, scale = 0.3 }) => {
  const [wavePosition, setWavePosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWavePosition((prev) => (prev + 1) % numDots);
    }, speed);
    return () => clearInterval(interval);
  }, [speed, numDots]);

  const renderDots = () => {
    return Array.from({ length: numDots }, (_, index) => {
      const distance = Math.abs(index - wavePosition);
      let color;
      if (distance === 0) {
        color = "white";
      } else if (distance === 1) {
        color = "lightgray";
      } else {
        color = "darkgray";
      }

      const height = 1 + (distance === 0 ? 3 : distance === 1 ? 2 : 0);

      return (
        <div
          key={index}
          style={{
            backgroundColor: color,
            width: "10px",
            height: `${height * 10}px`,
            margin: "0 5px",
            borderRadius: "5px",
          }}
        ></div>
      );
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-end", transform: `scale(${scale})` }}>
      {renderDots()}
    </div>
  );
};

export default LoadingWave;
