'use client';

interface TestProgressProps {
  progress: number;
  status: string;
  onTerminate: () => void;
}

export default function TestProgress({ progress, status, onTerminate }: TestProgressProps) {
  const getStatusText = () => {
    if (status === 'completed') return '✅ Test Completed!';
    if (status === 'failed') return '❌ Test Failed';
    if (status === 'terminated') return '⏹️ Test Terminated';
    return '🔄 Running Test...';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{getStatusText()}</h3>
        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{Math.round(progress)}%</span>
      </div>
      
      <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onTerminate}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          ⏹️ Stop Test
        </button>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
