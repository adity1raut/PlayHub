import React from "react";
import {
  Gamepad2,
  Twitter,
  Facebook,
  Instagram,
  Twitch,
  Youtube,
  Heart,
} from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-gray-900 to-black border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Gamepad2 className="w-8 h-8 text-purple-500 mr-2" />
            <span className="text-2xl font-bold text-white">GAME PORTAL</span>
          </div>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Your ultimate destination for gaming news, reviews, and community.
            Join thousands of gamers in our vibrant community.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors"
            >
              <Twitch className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors"
            >
              <Youtube className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm flex items-center">
              Made with <Heart className="w-4 h-4 mx-1 text-red-500" /> by Game
              Portal Team
            </p>
            <p className="text-gray-500 text-sm mt-2 md:mt-0">
              © {new Date().getFullYear()} Game Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
