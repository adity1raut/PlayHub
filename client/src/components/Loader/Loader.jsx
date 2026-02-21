import { Gamepad2 } from "lucide-react";

const Loader = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center z-50">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center shadow-2xl border border-purple-500/30">
          <Gamepad2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-white font-mono tracking-widest">
          PLAYHUB
        </h1>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto"></div>
      </div>
    </div>
  );
};

export default Loader;
