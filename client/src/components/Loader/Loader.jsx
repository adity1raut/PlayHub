import React, { useState, useEffect, useMemo } from "react";
import {
  Gamepad2,
  Zap,
  Trophy,
  Target,
  Cpu,
  Shield,
  Sword,
} from "lucide-react";

const Loader = () => {
  const [loadingText, setLoadingText] = useState("INITIALIZING GAME");
  const [progress, setProgress] = useState(0);

  // Fixed positions for floating icons
  const floatingIcons = useMemo(
    () =>
      Array(12)
        .fill()
        .map((_, i) => ({
          id: i,
          left: (i * 23.7) % 90,
          top: (i * 17.3 + 5) % 90,
          fontSize: 12 + ((i * 2) % 8),
          animationDelay: (i * 0.8) % 4,
          animationDuration: 4 + ((i * 0.3) % 2),
          iconType: i % 4,
        })),
    [],
  );

  // Fixed positions for hexagons
  const hexagons = useMemo(
    () =>
      Array(20)
        .fill()
        .map((_, i) => ({
          id: i,
          left: (i * 13.5) % 90,
          top: (i * 19.7) % 90,
          animationDelay: (i * 0.4) % 3,
          animationDuration: 8 + ((i * 0.7) % 4),
        })),
    [],
  );

  // Nebula effect elements - same as GamingBackground
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

  useEffect(() => {
    const texts = [
      "INITIALIZING GAME",
      "LOADING TEXTURES",
      "COMPILING SHADERS",
      "CONNECTING TO SERVER",
      "OPTIMIZING PERFORMANCE",
      "READY TO PLAY",
    ];
    let textIndex = 0;

    const textInterval = setInterval(() => {
      textIndex = (textIndex + 1) % texts.length;
      setLoadingText(texts[textIndex]);
    }, 800);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 1.5;
      });
    }, 80);

    return () => {
      clearInterval(textInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const renderIcon = (iconType) => {
    switch (iconType) {
      case 0:
        return <Gamepad2 />;
      case 1:
        return <Zap />;
      case 2:
        return <Shield />;
      case 3:
        return <Sword />;
      default:
        return <Gamepad2 />;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center z-50 overflow-hidden">
      {/* Gaming Background Effects */}
      <div className="absolute inset-0">
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

        {/* Floating Gaming Icons */}
        {floatingIcons.map((icon) => (
          <div
            key={`icon-${icon.id}`}
            className="absolute text-purple-400/30 animate-float"
            style={{
              left: `${icon.left}%`,
              top: `${icon.top}%`,
              fontSize: `${icon.fontSize}px`,
              animationDelay: `${icon.animationDelay}s`,
              animationDuration: `${icon.animationDuration}s`,
            }}
          >
            {renderIcon(icon.iconType)}
          </div>
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
                animationDelay: `${hex.animationDelay}s`,
                animationDuration: `${hex.animationDuration}s`,
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

      <div className="text-center space-y-8 relative z-10">
        {/* Gaming Logo */}
        <div className="relative">
          <div className="w-28 h-28 mx-auto bg-gradient-to-r from-purple-800 to-purple-900 rounded-xl flex items-center justify-center transform animate-pulse-glow shadow-2xl shadow-purple-500/50 border border-gray-700">
            <div className="relative">
              <Gamepad2 className="w-14 h-14 text-white drop-shadow-lg" />
              {/* Power indicator */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Orbital Gaming Elements */}
          <div className="absolute inset-0 w-36 h-36 -m-4">
            <div className="absolute top-0 left-1/2 w-4 h-4 bg-purple-400 rounded-lg flex items-center justify-center transform -translate-x-1/2 animate-orbit shadow-lg shadow-purple-400/50">
              <Zap className="w-3 h-3 text-purple-900" />
            </div>
            <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-gray-400 rounded-lg flex items-center justify-center transform -translate-x-1/2 animate-orbit-reverse shadow-lg shadow-gray-400/50">
              <Trophy className="w-3 h-3 text-gray-900" />
            </div>
            <div className="absolute left-0 top-1/2 w-4 h-4 bg-indigo-400 rounded-lg flex items-center justify-center transform -translate-y-1/2 animate-orbit-horizontal shadow-lg shadow-indigo-400/50">
              <Target className="w-3 h-3 text-indigo-900" />
            </div>
            <div className="absolute right-0 top-1/2 w-4 h-4 bg-pink-400 rounded-lg flex items-center justify-center transform -translate-y-1/2 animate-orbit-horizontal-reverse shadow-lg shadow-pink-400/50">
              <Cpu className="w-3 h-3 text-pink-900" />
            </div>
          </div>
        </div>

        {/* Game Title */}
        <div>
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-gray-200 to-purple-400 animate-text-glow drop-shadow-2xl font-mono">
            PLAYHUB
          </h1>
          <p className="text-2xl text-gray-200 mt-2 tracking-wider font-light drop-shadow-lg">
            LOADING
          </p>
        </div>

        {/* Loading Progress */}
        <div className="space-y-6 w-96">
          <div className="text-center">
            <p className="text-purple-200 font-mono text-lg tracking-widest animate-pulse drop-shadow-lg">
              {loadingText}...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full h-3 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-purple-500/30 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-800 transition-all duration-300 ease-out relative shadow-lg animate-progress-glow"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/50 blur-sm animate-scan"></div>
              </div>
            </div>
            <div className="flex justify-between text-sm text-gray-300 mt-2 drop-shadow font-mono">
              <span>0%</span>
              <span className="text-purple-400 font-bold">
                {Math.floor(progress)}%
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* System Status */}
          <div className="text-xs font-mono text-gray-400 space-y-1 bg-gray-800/30 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between">
              <span>CPU:</span>
              <span className="text-purple-400">OPTIMAL</span>
            </div>
            <div className="flex justify-between">
              <span>GPU:</span>
              <span className="text-purple-400">READY</span>
            </div>
            <div className="flex justify-between">
              <span>RAM:</span>
              <span className="text-gray-300">
                {Math.floor(progress * 0.8)}%
              </span>
            </div>
          </div>
        </div>

        {/* Loading Animation */}
        <div className="flex justify-center space-x-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-purple-400 rounded-full animate-bounce shadow-lg shadow-purple-400/50"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-glow {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 40px rgba(168, 85, 247, 0.8);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes text-glow {
          0%,
          100% {
            text-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
          }
          50% {
            text-shadow: 0 0 40px rgba(168, 85, 247, 1);
          }
        }
        .animate-text-glow {
          animation: text-glow 2s ease-in-out infinite;
        }

        @keyframes progress-glow {
          0%,
          100% {
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
          }
        }
        .animate-progress-glow {
          animation: progress-glow 1.5s ease-in-out infinite;
        }

        @keyframes scan {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
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

        @keyframes orbit {
          from {
            transform: rotate(0deg) translateX(70px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(70px) rotate(-360deg);
          }
        }
        .animate-orbit {
          animation: orbit 3s linear infinite;
        }

        @keyframes orbit-reverse {
          from {
            transform: rotate(0deg) translateX(70px) rotate(0deg);
          }
          to {
            transform: rotate(-360deg) translateX(70px) rotate(360deg);
          }
        }
        .animate-orbit-reverse {
          animation: orbit-reverse 4s linear infinite;
        }

        @keyframes orbit-horizontal {
          from {
            transform: rotate(0deg) translateY(70px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateY(70px) rotate(-360deg);
          }
        }
        .animate-orbit-horizontal {
          animation: orbit-horizontal 3.5s linear infinite;
        }

        @keyframes orbit-horizontal-reverse {
          from {
            transform: rotate(0deg) translateY(70px) rotate(0deg);
          }
          to {
            transform: rotate(-360deg) translateY(70px) rotate(360deg);
          }
        }
        .animate-orbit-horizontal-reverse {
          animation: orbit-horizontal-reverse 2.8s linear infinite;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-10px) rotate(2deg);
          }
          66% {
            transform: translateY(5px) rotate(-2deg);
          }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Loader;
