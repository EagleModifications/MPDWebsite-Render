import React, { useState } from "react";

interface WheelEntry {
  id: number;
  name: string;
}

const initialEntries: WheelEntry[] = [
  { id: 1, name: "Ali" },
  { id: 2, name: "Beatriz" },
  { id: 3, name: "Charles" },
  { id: 4, name: "Diya" },
  { id: 5, name: "Eric" },
  { id: 6, name: "Fatima" },
  { id: 7, name: "Gabriel" },
  { id: 8, name: "Hanna" },
];

export default function WheelOfNames(): JSX.Element {
  const [entries, setEntries] = useState<WheelEntry[]>(initialEntries);
  const [results, setResults] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"entries" | "results">(
    "entries",
  );

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const shuffleEntries = (): void => {
    setEntries((current) => {
      const shuffled = [...current];

      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      return shuffled;
    });
  };

  const sortEntries = (): void => {
    setEntries((current) =>
      [...current].sort((a, b) => a.name.localeCompare(b.name)),
    );
  };

  const spinWheel = (): void => {
    if (entries.length === 0) return;

    const index = Math.floor(Math.random() * entries.length);
    const winner = entries[index];

    setResults((current) => [...current, winner.name]);
    setActiveTab("results");
  };

  const newWheel = (): void => {
    setEntries(initialEntries);
    setResults([]);
    setActiveTab("entries");
  };

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(false);
    }
  };

  return (
    <div className="wheel-page">
      <header className="header">
        <div className="toolbar">
          <a className="logo-link" href="/">
            <div className="toolbar-title">
              <img
                src="/images/logo-blue.png"
                alt="logo"
                width={38}
                height={38}
              />

              <h1>Wheel of Names</h1>
            </div>
          </a>

          <div className="toolbar-spacer" />

          <div className="toolbar-actions">
            <button type="button" aria-label="Customize">
              <i className="fas fa-palette" />
              <span>Customize</span>
            </button>

            <button type="button" aria-label="New" onClick={newWheel}>
              <i className="fas fa-file" />
              <span>New</span>
            </button>

            <button type="button" aria-label="Open">
              <i className="fas fa-folder-open" />
              <span>Open</span>
            </button>

            <button type="button" aria-label="Save">
              <i className="fas fa-save" />
              <span>Save</span>
            </button>

            <button type="button" aria-label="Share">
              <i className="fas fa-share-alt" />
              <span>Share</span>
            </button>

            <a
              className="toolbar-button"
              href="/gallery"
              aria-label="Gallery"
            >
              <i className="fas fa-search" />
              <span>Gallery</span>
            </a>

            <button
              type="button"
              aria-label="Fullscreen"
              onClick={toggleFullscreen}
            >
              <i className="fas fa-expand" />
            </button>

            <button
              type="button"
              aria-label="More"
              onClick={() => setIsMenuOpen((value) => !value)}
            >
              <span>More</span>
              <i className="fas fa-caret-down" />
            </button>

            <button type="button" aria-label="Language">
              <i className="fas fa-globe" />
              <span>English</span>
            </button>
          </div>

          <button
            type="button"
            className="hamburger"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            <i className="fas fa-bars" />
          </button>
        </div>
      </header>

      <main className="page-content">
        <div className="content-grid">
          <aside className="left-column">
            <button
              type="button"
              className="edit-button"
              aria-label="Edit"
            >
              <i className="fas fa-pencil-alt" />
            </button>
          </aside>

          <section className="center-column">
            <div className="wheel-container">
              <div
                className="wheel"
                role="button"
                tabIndex={0}
                aria-label="wheel"
                onClick={spinWheel}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    spinWheel();
                  }
                }}
              >
                <canvas
                  width={700}
                  height={700}
                  aria-label="wheel"
                />

                <svg
                  viewBox="-100 -100 200 200"
                  filter="drop-shadow(0 0 10px #000)"
                  fontFamily="sans-serif"
                  fontWeight={800}
                  fontSize={12}
                  fill="white"
                >
                  <defs>
                    <path
                      id="curve-top"
                      d="M -52 0 A 1 1 0 0 1 52 0"
                    />

                    <path
                      id="curve-bottom"
                      d="M -60 0 A 1 1 0 0 0 60 0"
                    />
                  </defs>

                  <text textAnchor="middle">
                    <textPath
                      xlinkHref="#curve-top"
                      startOffset="50%"
                    >
                      <tspan className="tap-to-spin">
                        Tap to spin
                      </tspan>

                      <tspan className="click-to-spin">
                        Click to spin
                      </tspan>
                    </textPath>
                  </text>

                  <text
                    textAnchor="middle"
                    className="click-to-spin"
                  >
                    <textPath
                      xlinkHref="#curve-bottom"
                      startOffset="50%"
                    >
                      or press ctrl+enter
                    </textPath>
                  </text>
                </svg>
              </div>
            </div>
          </section>

          <aside className="right-column">
            <div className="editor-card">
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  className={
                    activeTab === "entries"
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() => setActiveTab("entries")}
                >
                  <span>Entries</span>
                  <span className="badge">{entries.length}</span>
                </button>

                <button
                  type="button"
                  className={
                    activeTab === "results"
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() => setActiveTab("results")}
                >
                  <span>Results</span>
                  <span className="badge">{results.length}</span>
                </button>
              </div>

              {activeTab === "entries" && (
                <div className="tab-panel">
                  <div className="editor-actions">
                    <button
                      type="button"
                      onClick={shuffleEntries}
                    >
                      <i className="fas fa-random" />
                      Shuffle
                    </button>

                    <button
                      type="button"
                      onClick={sortEntries}
                    >
                      <i className="fas fa-sort-alpha-up" />
                      Sort
                    </button>

                    <button type="button">
                      <i className="fas fa-image" />
                      Add image
                      <i className="fas fa-caret-down" />
                    </button>

                    <label className="checkbox">
                      <input type="checkbox" />
                      <span>Advanced</span>
                    </label>
                  </div>

                  <div
                    className="basic-editor"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    spellCheck={false}
                  >
                    {entries.map((entry) => (
                      <div key={entry.id}>
                        {entry.name}
                      </div>
                    ))}
                  </div>

                  <div className="add-wheel-container">
                    <button
                      type="button"
                      onClick={() =>
                        setEntries((current) => [
                          ...current,
                          {
                            id: Date.now(),
                            name: `Entry ${current.length + 1}`,
                          },
                        ])
                      }
                    >
                      <i className="fas fa-plus" />
                      Add wheel
                    </button>

                    <button
                      type="button"
                      aria-label='Expand "Add wheel"'
                    >
                      <i className="fas fa-caret-down" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "results" && (
                <div className="tab-panel results-panel">
                  {results.length === 0 ? (
                    <p>No results yet.</p>
                  ) : (
                    results.map((result, index) => (
                      <div
                        className="result"
                        key={`${result}-${index}`}
                      >
                        {result}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="editor-footer">
                <span>Version 432</span>

                <a href="/changelog">
                  Changelog
                </a>
              </div>
            </div>

            <button
              type="button"
              className="hide-editor"
              aria-label="Hide editor"
            >
              <i className="fas fa-chevron-right" />
            </button>
          </aside>
        </div>

        <hr />

        <section className="about-card-row">
          <div className="about-card-column">
            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                What is the wheel spinner for?
              </h2>

              <p>
                Every day we hear from people who use our
                website in new ways:
              </p>

              <ul>
                <li>
                  Random name picker in the classroom: pick
                  which student will answer the next question.
                </li>

                <li>
                  Retailers can spin the wheel to pick which
                  loyal customer will get the monthly giveaway.
                </li>

                <li>
                  Use the wheel during presentations to pick a
                  lucky winner.
                </li>

                <li>
                  Randomize who speaks first during a daily
                  standup meeting.
                </li>

                <li>
                  Put your to-do items on a wheel and spin to
                  find which one to start with.
                </li>

                <li>
                  Pick who goes first in a game at a party.
                </li>

                <li>
                  Put dinner alternatives on the wheel when you
                  cannot agree what to have.
                </li>
              </ul>
            </article>

            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                How to use the wheel spinner
              </h2>

              <p>
                It's easy: type in your entries in the textbox
                to the right of the wheel, then click the wheel
                to spin it and get a random winner.
              </p>

              <p>
                To customize the colors, sounds, and spin time,
                click <strong>Customize</strong> at the top of
                the page.
              </p>
            </article>

            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                Activity in 2026
              </h2>

              <div className="stat">
                <span>Wheel spins</span>
                <strong>0</strong>
              </div>

              <div className="stat">
                <span>Hours of spinning</span>
                <strong>0</strong>
              </div>
            </article>
          </div>

          <div className="about-card-column">
            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                Wheel features
              </h2>

              <p>
                We aim to provide a flexible and easy-to-use
                wheel spinner.
              </p>

              <ul>
                <li>
                  <strong>Rich audio library:</strong> Choose
                  from music tracks and sound effects.
                </li>

                <li>
                  <strong>Multi-wheel management:</strong>
                  Manage multiple wheels on the same page.
                </li>

                <li>
                  <strong>Weighted wheels:</strong> Set
                  different weights for entries.
                </li>

                <li>
                  <strong>Instant sharing:</strong> Generate
                  short links to share wheels.
                </li>

                <li>
                  <strong>Your own visuals:</strong> Customize
                  backgrounds, logos, and colors.
                </li>

                <li>
                  <strong>Millions of images:</strong> Add
                  custom images to your wheel.
                </li>

                <li>
                  <strong>Privacy-first storage:</strong> Save
                  wheels locally or in the cloud.
                </li>

                <li>
                  <strong>Authentic physics:</strong> Simulate
                  the feel of a physical spinning wheel.
                </li>

                <li>
                  <strong>Built for large groups:</strong>
                  Handle very large lists of names.
                </li>

                <li>
                  <strong>Global localization:</strong>
                  Support multiple languages.
                </li>
              </ul>
            </article>

            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                Is my data private?
              </h2>

              <p>
                We are committed to protecting and respecting
                your privacy and the security of your data.
              </p>

              <p>
                We follow industry best practices for data
                encryption and backups.
              </p>
            </article>

            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                Can I close the ads?
              </h2>

              <p>
                Ads help keep the website free. Users can close
                ads for the duration of their session.
              </p>
            </article>
          </div>

          <div className="about-card-column">
            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                Can I use the wheel in OBS or Streamlabs?
              </h2>

              <p>
                Yes. The wheel can be added as a browser source
                in streaming software.
              </p>

              <ul>
                <li>In-game challenges.</li>
                <li>Character builds.</li>
                <li>Viewer giveaways.</li>
              </ul>
            </article>

            <article className="about-card">
              <h2>
                <img
                  src="/icons/favicon-32x32.png"
                  alt=""
                  width={32}
                  height={32}
                />
                Is the wheel truly random?
              </h2>

              <p>
                Each spin is independent and produces a random
                result.
              </p>

              <p>
                <strong>How We Guarantee Randomness</strong>:
                the wheel can use cryptographically secure
                browser randomness rather than relying solely
                on standard pseudo-random values.
              </p>

              <p>
                If you want to prevent a winner from being
                selected again, remove the winner after each
                spin.
              </p>

              <a
                className="primary-button"
                href="/randomness-audit"
              >
                Run 10,000 Spins
              </a>
            </article>
          </div>
        </section>

        <hr />

        <footer className="footer">
          <div>
            <span>
              <i className="fas fa-balance-scale" />
              <a href="/terms">Terms &amp; conditions</a>
            </span>

            <span>
              <i className="fas fa-user-secret" />
              <a href="/privacy-policy">
                Privacy policy
              </a>
            </span>
          </div>

          <div>
            <span>
              <i className="fas fa-question-circle" />
              <a href="/faq">FAQ</a>
            </span>

            <span>
              <i className="fas fa-comment" />
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSeryxMCuDjQUGawpgIeMwSY-81fqwdbpVTIOyh1-WJG5LCeeQ/viewform"
                target="_blank"
                rel="noreferrer"
              >
                Feedback
              </a>
            </span>
          </div>

          <div>
            <span>
              <i className="fas fa-code" />
              <a href="/api-doc">API</a>
            </span>

            <span>
              <i className="fas fa-bullhorn" />
              <a
                href="https://blog.wheelofnames.com"
                target="_blank"
                rel="noreferrer"
              >
                Blog
              </a>
            </span>
          </div>

          <div>
            <span>
              <i className="fas fa-video" />
              <a href="/streaming">Streaming</a>
            </span>
          </div>

          <span className="build">7a6d / ?</span>
        </footer>
      </main>
    </div>
  );
}
