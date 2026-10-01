import { Link } from "react-router-dom"

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/60">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1fr_auto]">
          {/* Brand */}
          <div className="max-w-md">
            <Link
              to="/"
              className="inline-flex items-center gap-3"
            >
              <img
                src="/logo.png"
                alt="CALIRP"
                className="h-9 w-9 object-contain"
              />

              <span className="text-lg font-black tracking-tight text-foreground">
                CALIRP
              </span>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              A modern FiveM roleplay community focused on high-quality
              scenes and a city-first vibe.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            {/* Community */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Community
              </h3>

              <div className="mt-4 flex flex-col gap-3">
                <a
                  href="https://discord.gg/metropd"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Discord
                </a>

                <Link
                  to="/events"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Events
                </Link>
              </div>
            </div>

            {/* Portal */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Portal
              </h3>

              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Member Login
                </Link>

                <Link
                  to="/ban-appeals"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ban Appeal
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 border-t border-white/5 pt-6">
          <div className="flex flex-col gap-3 text-xs text-muted-foreground/60 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {new Date().getFullYear()} CaliRP - California Gaming Network
            </span>

            <span>
              Not affiliated with Rockstar Games or Take-Two Interactive.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
