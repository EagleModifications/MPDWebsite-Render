import { Link } from "react-router-dom"

export default function Footer() {
  return (
    <footer className="relative z-20 border-t border-white/10 bg-[#050509]">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-start">
          {/* Brand */}
          <div className="max-w-md">
            <div className="inline-flex items-center gap-3">
              <img
                src="/logo.png"
                alt="MPD"
                className="h-9 w-9 object-contain"
              />

              <span className="text-lg font-black tracking-tight text-white transition-colors">
                METRO POLICE DEPARTMENT
              </span>
            </div>

            <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">
              The Metro Police Department is built around immersive law enforcement, dedicated officers,
              community interaction, and unforgettable stories across CaliRP.
            </p>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-16 sm:gap-24">
            {/* Community */}
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Community
              </h3>

              <div className="mt-4 flex flex-col gap-3">
                <a
                  href="https://discord.gg/metropd"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-white/60 transition-colors hover:text-foreground"
                >
                  Discord
                </a>

                <Link
                  to="/events"
                  className="text-sm text-white/60 transition-colors hover:text-foreground"
                >
                  Events
                </Link>

                <Link
                  to="/gallery"
                  className="text-sm text-white/60 transition-colors hover:text-foreground"
                >
                  Gallery
                </Link>
              </div>
            </div>

            {/* Portal */}
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Dashboard
              </h3>

              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/sign-in"
                  className="text-sm text-white/60 transition-colors hover:text-foreground"
                >
                  Member Login
                </Link>

                <Link
                  to="/dashboard"
                  className="text-sm text-white/60 transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom divider */}
        <div className="mt-10 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-white/35">
              COPYRIGHT © {new Date().getFullYear()} METRO POLICE DEPARTMENT - California Roleplay, All rights Reserved
            </span>

            <span className="text-white/35">
              Created by {" "}
              <a
                href="https://discord.com/users/1314550564389912609"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 transition-colors hover:text-blue-400"
              >
                kieranbe1
              </a>
            </span>
            
          </div>
        </div>
      </div>
    </footer>
  )
}
