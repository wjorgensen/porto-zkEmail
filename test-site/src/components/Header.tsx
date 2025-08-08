'use client';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white backdrop-blur-md border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#1a1a1a"/>
              <path d="M10 12H22M10 16H18M10 20H20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-gray-900">Porto</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">zkEmail Demo</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Documentation
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}