import React, { useState, useEffect } from "react";
import { Gamepad2 } from "lucide-react";

const Loader = () => {
  const [loadingText, setLoadingText] = useState("INITIALIZING GAME");
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");

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

    const dotsInterval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 400);

    return () => {
      clearInterval(textInterval);
      clearInterval(progressInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center z-50">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(90deg, rgba(168, 85, 247, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(168, 85, 247, 0.1) 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="text-center space-y-8 relative z-10 px-4">
        {/* Gaming Logo */}
        <div className="relative inline-block">
          <div className="w-28 h-28 mx-auto bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-purple-500/30">
            <Gamepad2 className="w-14 h-14 text-white" />
          </div>

          {/* Corner accents */}
          <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-purple-400" />
          <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-purple-400" />
          <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-purple-400" />
          <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-purple-400" />
        </div>

        {/* Game Title */}
        <div>
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-white to-purple-400 font-mono">
            PLAYHUB
          </h1>
          <p className="text-xl text-gray-300 mt-2 tracking-widest font-light">
            LOADING
          </p>
        </div>

        {/* Loading Progress */}
        <div className="space-y-6 w-full max-w-md mx-auto">
          <div className="text-center min-h-[32px]">
            <p className="text-purple-300 font-mono text-base tracking-wide">
              {loadingText}
              {dots}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-purple-500/30">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-700 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-400 mt-2 font-mono">
              <span>0%</span>
              <span className="text-purple-400 font-bold">
                {Math.floor(progress)}%
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* System Status */}
          <div className="text-xs font-mono text-gray-400 space-y-2 bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
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

        {/* Loading Dots */}
        <div className="flex justify-center space-x-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-purple-400 rounded-full"
              style={{
                opacity: dots.length > i ? 1 : 0.3,
                transition: "opacity 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Loader;
