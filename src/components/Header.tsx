interface HeaderProps {
  hasNovel: boolean;
  isGenerating: boolean;
  onReset: () => void;
}

export function Header({ hasNovel, isGenerating, onReset }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#F6F5F2]/95 backdrop-blur-sm border-b border-zinc-200/90">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <a
          href="#top"
          className="font-serif text-xl font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          KaryaNaskah
        </a>

        {/* Zone 2: Clean single-line nav links */}
        <nav
          aria-label="Navigasi halaman"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600"
        >
          <a
            href="#konfigurasi"
            className="hover:text-zinc-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Konfigurasi
          </a>
          <a
            href="#kerangka"
            className="hover:text-zinc-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Kerangka
          </a>
          <a
            href="#naskah"
            className="hover:text-zinc-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Naskah
          </a>
        </nav>

        {/* Zone 3: Single primary header action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasNovel || isGenerating}
            className="px-4 py-2 text-sm font-medium text-zinc-900 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Mulai Novel Baru
          </button>
        </div>
      </div>
    </header>
  );
}
