import React, { useState, useEffect, useMemo } from "react";

const GamingBackground = () => {
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);

  // Generate fixed positions and properties that won't change on re-render
  const nebulaElements = useMemo(
    () => ({
      large: Array(5)
        .fill()
        .map((_, i) => ({
          id: i,
          width: 200 + ((i * 50) % 300),
          height: 150 + ((i * 40) % 200),
          left: (20 + i * 15) % 80,
          top: (10 + i * 18) % 80,
          color1: [
            120 + ((i * 30) % 135),
            50 + ((i * 20) % 100),
            200 + ((i * 10) % 55),
          ],
          color2: [
            80 + ((i * 25) % 100),
            30 + ((i * 15) % 80),
            150 + ((i * 20) % 105),
          ],
          delay: i * 2,
          duration: 15 + ((i * 3) % 10),
        })),
      medium: Array(8)
        .fill()
        .map((_, i) => ({
          id: i,
          width: 100 + ((i * 25) % 150),
          height: 80 + ((i * 20) % 120),
          left: (i * 12) % 90,
          top: (5 + i * 11) % 90,
          color1: [
            200 + ((i * 15) % 55),
            100 + ((i * 18) % 100),
            200 + ((i * 12) % 55),
          ],
          color2: [
            150 + ((i * 20) % 105),
            80 + ((i * 16) % 80),
            180 + ((i * 14) % 75),
          ],
          delay: i * 1.5,
          duration: 12 + ((i * 2) % 8),
        })),
      small: Array(12)
        .fill()
        .map((_, i) => ({
          id: i,
          width: 40 + ((i * 10) % 80),
          height: 30 + ((i * 8) % 60),
          left: (i * 8) % 95,
          top: (3 + i * 7) % 95,
          color1: [
            180 + ((i * 12) % 75),
            120 + ((i * 14) % 80),
            220 + ((i * 8) % 35),
          ],
          color2: [
            100 + ((i * 18) % 100),
            60 + ((i * 16) % 100),
            180 + ((i * 10) % 75),
          ],
          delay: i * 1,
          duration: 8 + ((i * 1.5) % 6),
        })),
    }),
    [],
  );

  const stars = useMemo(
    () =>
      Array(50)
        .fill()
        .map((_, i) => ({
          id: i,
          left: (i * 7.3) % 100,
          top: (i * 11.7) % 100,
          delay: (i * 0.1) % 3,
          duration: 2 + ((i * 0.05) % 2),
        })),
    [],
  );

  const hexagons = useMemo(
    () =>
      Array(20)
        .fill()
        .map((_, i) => ({
          id: i,
          left: (i * 13.5) % 90,
          top: (i * 17.3) % 90,
          delay: (i * 0.3) % 3,
          duration: 8 + ((i * 0.7) % 4),
        })),
    [],
  );

  useEffect(() => {
    const handleKeyPress = () => {
      setIsTyping(true);

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      const newTimeout = setTimeout(() => {
        setIsTyping(false);
      }, 1000);

      setTypingTimeout(newTimeout);
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  return (
    <>
      <div className={`absolute inset-0 ${isTyping ? "animation-paused" : ""}`}>
        {/* Nebula Effect */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large Nebula Clouds */}
          {nebulaElements.large.map((nebula) => (
            <div
              key={`nebula-large-${nebula.id}`}
              className="absolute rounded-full animate-nebula-drift"
              style={{
                width: `${nebula.width}px`,
                height: `${nebula.height}px`,
                left: `${nebula.left}%`,
                top: `${nebula.top}%`,
                background: `radial-gradient(ellipse at center, 
                  rgba(${nebula.color1[0]}, ${nebula.color1[1]}, ${nebula.color1[2]}, 0.3) 0%,
                  rgba(${nebula.color2[0]}, ${nebula.color2[1]}, ${nebula.color2[2]}, 0.2) 40%,
                  transparent 70%)`,
                filter: "blur(40px)",
                animationDelay: `${nebula.delay}s`,
                animationDuration: `${nebula.duration}s`,
              }}
            />
          ))}

          {/* Medium Nebula Clouds */}
          {nebulaElements.medium.map((nebula) => (
            <div
              key={`nebula-medium-${nebula.id}`}
              className="absolute rounded-full animate-nebula-float"
              style={{
                width: `${nebula.width}px`,
                height: `${nebula.height}px`,
                left: `${nebula.left}%`,
                top: `${nebula.top}%`,
                background: `radial-gradient(ellipse at center, 
                  rgba(${nebula.color1[0]}, ${nebula.color1[1]}, ${nebula.color1[2]}, 0.25) 0%,
                  rgba(${nebula.color2[0]}, ${nebula.color2[1]}, ${nebula.color2[2]}, 0.15) 50%,
                  transparent 80%)`,
                filter: "blur(25px)",
                animationDelay: `${nebula.delay}s`,
                animationDuration: `${nebula.duration}s`,
              }}
            />
          ))}

          {/* Small Nebula Wisps */}
          {nebulaElements.small.map((nebula) => (
            <div
              key={`nebula-small-${nebula.id}`}
              className="absolute rounded-full animate-nebula-wisp"
              style={{
                width: `${nebula.width}px`,
                height: `${nebula.height}px`,
                left: `${nebula.left}%`,
                top: `${nebula.top}%`,
                background: `radial-gradient(ellipse at center, 
                  rgba(${nebula.color1[0]}, ${nebula.color1[1]}, ${nebula.color1[2]}, 0.2) 0%,
                  rgba(${nebula.color2[0]}, ${nebula.color2[1]}, ${nebula.color2[2]}, 0.1) 60%,
                  transparent 90%)`,
                filter: "blur(15px)",
                animationDelay: `${nebula.delay}s`,
                animationDuration: `${nebula.duration}s`,
              }}
            />
          ))}
        </div>

        {/* Circuit Pattern Background */}
        <div className="absolute inset-0 opacity-20">
          {/* Horizontal lines */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`h-line-${i}`}
              className="absolute h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse"
              style={{
                top: `${15 + i * 10}%`,
                left: "10%",
                right: "10%",
                animationDelay: `${i * 0.3}s`,
                animationDuration: "2s",
              }}
            />
          ))}

          {/* Vertical lines */}
          {[...Array(6)].map((_, i) => (
            <div
              key={`v-line-${i}`}
              className="absolute w-px bg-gradient-to-b from-transparent via-gray-400 to-transparent animate-pulse"
              style={{
                left: `${20 + i * 12}%`,
                top: "10%",
                bottom: "10%",
                animationDelay: `${i * 0.4}s`,
                animationDuration: "2.5s",
              }}
            />
          ))}
        </div>

        {/* Twinkling Stars */}
        {stars.map((star) => (
          <div
            key={`star-${star.id}`}
            className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}

        {/* Hexagon Pattern */}
        <div className="absolute inset-0 opacity-10">
          {hexagons.map((hex) => (
            <div
              key={`hex-${hex.id}`}
              className="absolute w-8 h-8 border border-purple-400 transform rotate-45 animate-spin-slow"
              style={{
                left: `${hex.left}%`,
                top: `${hex.top}%`,
                animationDelay: `${hex.delay}s`,
                animationDuration: `${hex.duration}s`,
              }}
            />
          ))}
        </div>

        {/* Data Stream Effect */}
        <div className="absolute right-4 top-0 bottom-0 w-1 overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <div
              key={`stream-${i}`}
              className="absolute w-full h-8 bg-gradient-to-b from-purple-400 to-transparent animate-data-stream"
              style={{
                animationDelay: `${i * 0.5}s`,
                animationDuration: "3s",
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        .animate-twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }

        @keyframes nebula-drift {
          0%,
          100% {
            transform: translate(0px, 0px) scale(1);
            opacity: 0.6;
          }
          25% {
            transform: translate(20px, -15px) scale(1.1);
            opacity: 0.8;
          }
          50% {
            transform: translate(-10px, -25px) scale(0.9);
            opacity: 0.7;
          }
          75% {
            transform: translate(-20px, 10px) scale(1.05);
            opacity: 0.9;
          }
        }
        .animate-nebula-drift {
          animation: nebula-drift 20s ease-in-out infinite;
        }

        @keyframes nebula-float {
          0%,
          100% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
            opacity: 0.5;
          }
          33% {
            transform: translate(15px, -20px) scale(1.2) rotate(1deg);
            opacity: 0.7;
          }
          66% {
            transform: translate(-15px, 15px) scale(0.8) rotate(-1deg);
            opacity: 0.6;
          }
        }
        .animate-nebula-float {
          animation: nebula-float 15s ease-in-out infinite;
        }

        @keyframes nebula-wisp {
          0%,
          100% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
            opacity: 0.4;
          }
          50% {
            transform: translate(25px, -30px) scale(1.3) rotate(2deg);
            opacity: 0.6;
          }
        }
        .animate-nebula-wisp {
          animation: nebula-wisp 10s ease-in-out infinite;
        }

        @keyframes data-stream {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
        .animate-data-stream {
          animation: data-stream 3s linear infinite;
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        .animation-paused {
          animation-play-state: paused;
        }
        .animation-paused * {
          animation-play-state: paused !important;
        }
      `}</style>
    </>
  );
};

export default GamingBackground;
