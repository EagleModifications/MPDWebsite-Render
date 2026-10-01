export default function DashboardFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 text-xs text-muted-foreground sm:px-6">
        <span>
          COPYRIGHT © {new Date().getFullYear()} METRO POLICE DEPARTMENT, All rights Reserved
        </span>

        <span className="shrink-0">
          Created by{" "}
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
    </footer>
  )
}
