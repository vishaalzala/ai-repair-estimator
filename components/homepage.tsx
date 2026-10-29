"use client";

import { useRef, useState } from "react";

export function Homepage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const sampleRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="repair-home">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="wrap">
        <nav className="nav" aria-label="Main navigation">
          <a href="/" className="brand" aria-label="AI Repair Estimator home">
            <span className="mark">
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 16V10l3-5h10l3 5v6M4 11h16M7 16v3M17 16v3M7 14h2M15 14h2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              repair<span style={{ color: "var(--green)" }}>estimator</span>
              <small>AI ASSISTED. HUMAN FOCUSED.</small>
            </span>
          </a>
          <div
            className={`navlinks${menuOpen ? " open" : ""}`}
            onClick={() => setMenuOpen(false)}
            id="navigation"
          >
            <a href="#how-it-works">How it works</a>
            <a href="#sample-report">Sample report</a>
            <a href="#pricing">Pricing</a>
            <a href="#faqs">FAQs</a>
          </div>
          <div className="nav-actions">
            <a className="login" href="/login">
              Log in
            </a>
            <a className="btn dark" href="/jobs/new">
              Get an estimate <span>↗</span>
            </a>
            <button
              className="menu"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-controls="navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ☰
            </button>
          </div>
        </nav>
      </header>
      <main id="main">
        <div className="wrap">
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span className="dot"></span> VEHICLE REPAIR ESTIMATES,
                SIMPLIFIED
              </div>
              <h1>
                A little damage.
                <br />A lot of questions.
                <br />
                <em>Let’s clear things up.</em>
              </h1>
              <p className="lead">
                Get a clearer picture of what your vehicle repairs could cost.
                Upload your photos and explore an AI-assisted repair estimate.
              </p>
              <div className="hero-actions">
                <a className="btn" href="/jobs/new">
                  Get my estimate <span>↗</span>
                </a>
                <a className="text-link" href="#sample-report">
                  <span className="play">▶</span> See a sample report
                </a>
              </div>
              <div className="micro">
                <span>
                  <b>✓</b> Free signup
                </span>
                <span>
                  <b>✓</b> No subscription
                </span>
                <span>
                  <b>✓</b> NZ$9 + GST per estimate
                </span>
              </div>
            </div>
            <div
              className="hero-art"
              aria-label="Illustration of a silver vehicle with example damage markers"
            >
              <div className="art-bg"></div>
              <div className="art-grid"></div>
              <div className="scan-label">
                <span
                  className="dot"
                  style={{ background: "var(--green)" }}
                ></span>{" "}
                A CLEARER VIEW OF YOUR REPAIRS
              </div>
              <div className="bracket"></div>
              <svg
                className="car"
                viewBox="0 0 800 480"
                role="img"
                aria-label="Silver sedan illustration with the front bumper highlighted"
              >
                <defs>
                  <linearGradient id="body" x1="0" y1="0" x2=".3" y2="1">
                    <stop stopColor="#f4f5f3" />
                    <stop offset=".38" stopColor="#dce0dd" />
                    <stop offset=".65" stopColor="#abb6b2" />
                    <stop offset="1" stopColor="#7b8985" />
                  </linearGradient>
                  <linearGradient id="hood" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#e7ebe6" />
                    <stop offset="1" stopColor="#b2beb6" />
                  </linearGradient>
                  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#687d76" />
                    <stop offset=".55" stopColor="#354b46" />
                    <stop offset="1" stopColor="#263c37" />
                  </linearGradient>
                  <linearGradient id="tire">
                    <stop stopColor="#1d2926" />
                    <stop offset="1" stopColor="#101d19" />
                  </linearGradient>
                  <radialGradient id="rim">
                    <stop stopColor="#bcc5bf" />
                    <stop offset=".8" stopColor="#85938c" />
                    <stop offset="1" stopColor="#34473e" />
                  </radialGradient>
                  <filter id="shadow">
                    <feGaussianBlur stdDeviation="12" />
                  </filter>
                </defs>
                <ellipse
                  cx="399"
                  cy="366"
                  rx="289"
                  ry="29"
                  fill="#687464"
                  opacity=".17"
                  filter="url(#shadow)"
                />
                <path
                  d="M110 274l19-39 98-34 77-61q14-11 40-13l138 9q31 5 53 23l88 65 59 35q17 9 20 29l2 33-40 31-95 8-303-16-106-18-50-24z"
                  fill="url(#body)"
                  stroke="#87988f"
                  strokeWidth="1.5"
                />
                <path
                  d="M237 202l82-61q10-7 26-7l128 9q24 4 43 17l75 57-206 14z"
                  fill="#a1aea7"
                />
                <path
                  d="M253 200l73-54q8-6 22-5l29 2 12 77z"
                  fill="url(#glass)"
                />
                <path
                  d="M390 144l77 5q20 4 36 16l64 49-165 7z"
                  fill="url(#glass)"
                />
                <path
                  d="M399 151l64 5q17 4 28 13l48 36-127-6z"
                  fill="#acc0b2"
                  opacity=".18"
                />
                <path d="M345 149l-64 47 43 7z" fill="#b1c1b9" opacity=".2" />
                <path
                  d="M129 237l109-31 147 27-97 52-175-4z"
                  fill="url(#hood)"
                  stroke="#a2aea6"
                />
                <path
                  d="M143 240l143 31 79-38"
                  fill="none"
                  stroke="#f3f6ed"
                  strokeWidth="2"
                  opacity=".8"
                />
                <path
                  d="M290 285l104-52 201-12 86 42-42 31-86 12-261-7z"
                  fill="#d7dfd7"
                  opacity=".5"
                />
                <path
                  d="M385 234l5 76M511 227l28 87M592 228l43 66"
                  stroke="#8b9b91"
                  strokeWidth="1.2"
                  fill="none"
                />
                <path
                  d="M402 251l24-2M542 243l21-2"
                  stroke="#62786c"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path d="M111 284l178 15 1 37-159-25-18-15z" fill="#6a7b72" />
                <path d="M121 287l154 13-5 18-132-16z" fill="#253f34" />
                <path
                  d="M138 292l121 10M145 299l112 9"
                  stroke="#6d8376"
                  strokeWidth="2"
                />
                <path
                  d="M125 265l51 3 20 17-67-8zM233 279l48-3 10 14-46 4z"
                  fill="#f5f7dc"
                  stroke="#9aaa92"
                />
                <path
                  d="M132 268l40 3 11 8"
                  stroke="#fffef3"
                  strokeWidth="3"
                  fill="none"
                />
                <path d="M682 264l17 11-1 15-23-6z" fill="#a86d54" />
                <path
                  d="M188 318q-3-54 28-59 35-5 42 69M557 342q-5-57 29-64 37-7 47 64"
                  fill="#334b3f"
                />
                <ellipse
                  cx="226"
                  cy="315"
                  rx="30"
                  ry="44"
                  transform="rotate(-11 226 315)"
                  fill="url(#tire)"
                />
                <ellipse
                  cx="232"
                  cy="315"
                  rx="20"
                  ry="33"
                  transform="rotate(-11 232 315)"
                  fill="url(#rim)"
                />
                <ellipse
                  cx="232"
                  cy="315"
                  rx="6"
                  ry="10"
                  transform="rotate(-11 232 315)"
                  fill="#425b4c"
                />
                <path
                  d="M232 284v23M235 323l4 22M216 304l11 8M238 319l12 7M220 334l9-12M237 308l7-14"
                  stroke="#d0d7cd"
                  strokeWidth="3"
                />
                <ellipse
                  cx="592"
                  cy="333"
                  rx="31"
                  ry="45"
                  transform="rotate(-9 592 333)"
                  fill="url(#tire)"
                />
                <ellipse
                  cx="598"
                  cy="333"
                  rx="21"
                  ry="34"
                  transform="rotate(-9 598 333)"
                  fill="url(#rim)"
                />
                <ellipse cx="598" cy="333" rx="6" ry="10" fill="#425b4c" />
                <path
                  d="M598 301v23M601 342l4 23M582 320l11 9M605 337l12 7M585 353l10-13M603 325l8-14"
                  stroke="#d0d7cd"
                  strokeWidth="3"
                />
                <path d="M269 334l285 20" stroke="#596f61" strokeWidth="5" />
                <path
                  d="M307 304l239 9"
                  stroke="#f1f4e8"
                  strokeWidth="1.3"
                  opacity=".7"
                />
                <path
                  d="M386 222l-19-9-13 4-2 12 24 6z"
                  fill="#b5c1b5"
                  stroke="#839687"
                />
                <path
                  d="M124 280l-12 18 21 15 43 5 8-25"
                  fill="#db5a35"
                  opacity=".1"
                  stroke="#db5a35"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <circle
                  cx="146"
                  cy="294"
                  r="20"
                  fill="none"
                  stroke="#db5a35"
                  strokeWidth="1.3"
                />
                <circle cx="146" cy="294" r="5" fill="#db5a35" />
                <path
                  d="M157 278l42-80 277-42"
                  stroke="#db5a35"
                  strokeWidth="1"
                  fill="none"
                  strokeDasharray="4 4"
                />
              </svg>
              <div className="float damage">
                <strong>
                  <span className="statusdot"></span> Visible damage identified
                </strong>
                <small>Front bumper · example only</small>
              </div>
              <div className="float estimate">
                <div className="estimate-top">
                  <span>INDICATIVE REPAIR RANGE</span>
                  <span>↗</span>
                </div>
                <div className="estimate-price">$850 – $1,200</div>
                <div className="estimate-bottom">
                  <span>✓</span> An itemised view of the possibilities
                </div>
              </div>
              <div className="illustrative">
                Illustration & sample figures only
              </div>
            </div>
          </section>
          <div className="trust">
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M12 3l8 3v6q-1 6-8 9-7-3-8-9V6zM8 12l3 3 5-6" />
              </svg>{" "}
              Your photos, your privacy
            </span>
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M7 3h8l4 4v14H5V3zM8 11h8M8 15h8M8 18h5" />
              </svg>{" "}
              Clear, itemised estimates
            </span>
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M4 6h16v13H4zM4 10h16M7 15h4" />
              </svg>{" "}
              One estimate. One fixed fee.
            </span>
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M4 19l5-12 4 4 4-7 3 15zM6 19h12" />
              </svg>{" "}
              Made for New Zealand
            </span>
          </div>
          <section className="section" id="how-it-works">
            <div className="section-head">
              <div>
                <div className="eyebrow">
                  <span className="dot"></span> FROM PHOTOS TO PERSPECTIVE
                </div>
                <h2>
                  Less guesswork.
                  <br />
                  Three simple steps.
                </h2>
              </div>
              <p>
                You don’t need to know your bumper from your bonnet. Start with
                what you can see.
              </p>
            </div>
            <div className="steps">
              <article className="step">
                <div className="step-num">01</div>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 7h5l2-3h5l2 3h4v14H3z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <h3>Show us the damage</h3>
                <p>
                  Add your vehicle details and upload clear photos. Include a
                  close-up and a wider view of the affected area.
                </p>
              </article>
              <article className="step">
                <div className="step-num">02</div>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 6h16v13H4zM4 10h16M7 15h3M15 15h2" />
                  </svg>
                </div>
                <h3>Review, then pay</h3>
                <p>
                  Check your details before paying NZ$10.35 including GST.
                  Signup is free, and there’s no subscription.
                </p>
              </article>
              <article className="step">
                <div className="step-num">03</div>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 3h9l4 4v14H6zM9 11h7M9 15h7M9 18h4M14 3v5h5" />
                  </svg>
                </div>
                <h3>Understand your options</h3>
                <p>
                  Review an indicative cost breakdown, assumptions and next
                  steps. Use it to prepare for a workshop conversation.
                </p>
              </article>
            </div>
          </section>
        </div>
        <section className="report-section" id="sample-report">
          <div className="wrap report-layout">
            <div className="report-copy">
              <div className="eyebrow">
                <span className="dot"></span> MORE THAN JUST A NUMBER
              </div>
              <h2>
                The detail you need.
                <br />
                In language you understand.
              </h2>
              <p>
                See what may need attention, how repair costs could add up, and
                what still needs a closer look.
              </p>
              <ul className="checks">
                <li>
                  <b>✓</b> Visible damage and possible repair work
                </li>
                <li>
                  <b>✓</b> Labour, parts and paint cost breakdown
                </li>
                <li>
                  <b>✓</b> An indicative range, with clear assumptions
                </li>
                <li>
                  <b>✓</b> A downloadable report to keep
                </li>
              </ul>
              <button
                className="subtle-link"
                id="sample-button"
                onClick={() => sampleRef.current?.showModal()}
              >
                Explore the sample <span>↗</span>
              </button>
            </div>
            <div className="report-paper">
              <div className="report-head">
                <div className="tinybrand">
                  <span style={{ color: "var(--green)" }}>◈</span>{" "}
                  repairestimator
                </div>
                <span className="sample-tag">ILLUSTRATIVE SAMPLE</span>
              </div>
              <h3>Your repair, broken down.</h3>
              <p className="vehicle">Example vehicle · Front bumper damage</p>
              <div className="line-item">
                <span>Repair preparation & labour</span>
                <span>$420.00</span>
              </div>
              <div className="line-item">
                <span>Paint & materials</span>
                <span>$300.00</span>
              </div>
              <div className="line-item">
                <span>Clips & small parts</span>
                <span>$80.00</span>
              </div>
              <div className="line-item">
                <span>Example subtotal</span>
                <span>$800.00</span>
              </div>
              <div className="line-item">
                <span>GST (15%)</span>
                <span>$120.00</span>
              </div>
              <div className="range">
                <span>Indicative range, incl. GST</span>
                <strong>$850 – $1,200</strong>
              </div>
              <p className="paper-note">
                Sample figures only. Actual costs depend on vehicle condition,
                parts and workshop inspection. The estimate service fee is
                separate.
              </p>
            </div>
          </div>
        </section>
        <div className="wrap">
          <section className="section pricing-layout" id="pricing">
            <div className="pricing-copy">
              <div className="eyebrow">
                <span className="dot"></span> SIMPLE, UPFRONT PRICING
              </div>
              <h2>
                A clearer picture.
                <br />
                Without the commitment.
              </h2>
              <p>
                Create your account for free. Pay only when you’re ready to
                request an estimate. No monthly plan to keep track of.
              </p>
              <div className="photo-tip">
                <strong>A small tip for a better estimate</strong>
                <p>
                  Take photos in good light, from a few different angles. Clear
                  photos make the visible damage easier to assess.
                </p>
              </div>
            </div>
            <div className="price-card">
              <div className="eyebrow">ONE VEHICLE. ONE DAMAGE ASSESSMENT.</div>
              <div className="price-big">
                <sup>NZ$</sup>10.35
              </div>
              <p className="tax-note">
                per estimate, including GST{" "}
                <span style={{ color: "#a8afa3" }}>·</span> NZ$9 + GST
              </p>
              <ul className="checks">
                <li>
                  <b>✓</b> AI-assisted damage assessment
                </li>
                <li>
                  <b>✓</b> Itemised indicative repair costs
                </li>
                <li>
                  <b>✓</b> Downloadable estimate report
                </li>
                <li>
                  <b>✓</b> Return to your report anytime in your account
                </li>
              </ul>
              <a className="btn dark" href="/jobs/new">
                Start my estimate <span>↗</span>
              </a>
              <p className="price-foot">Free signup. No subscription.</p>
            </div>
          </section>
          <section className="faq" id="faqs">
            <div className="faq-intro">
              <div className="eyebrow">
                <span className="dot"></span> GOOD QUESTIONS
              </div>
              <h2>
                A few things
                <br />
                worth knowing.
              </h2>
              <p>A little clarity before you get started.</p>
            </div>
            <div>
              <details>
                <summary>Is this a confirmed repair quote?</summary>
                <p>
                  No. This is an indicative AI-assisted estimate based on the
                  information and photos you provide. A repairer needs to
                  inspect the vehicle to confirm the work, parts and final
                  price. It is not insurer approval or a roadworthiness
                  assessment.
                </p>
              </details>
              <details>
                <summary>Do I need to pay to create an account?</summary>
                <p>
                  No. Signup is free. The fixed fee is NZ$9 plus NZ$1.35 GST,
                  for a total of NZ$10.35 per estimate. There is no monthly
                  subscription.
                </p>
              </details>
              <details>
                <summary>What photos should I upload?</summary>
                <p>
                  Include an overview of your vehicle, a wider view of the
                  affected area and clear close-up photos from several angles.
                  Use good lighting and avoid including people, documents or
                  unrelated personal information.
                </p>
              </details>
              <details>
                <summary>Can photos show every type of damage?</summary>
                <p>
                  No. Hidden, mechanical, electrical and structural damage may
                  require a physical inspection. An estimate should explain its
                  assumptions and where further assessment is needed.
                </p>
              </details>
              <details>
                <summary>What does the NZ$10.35 cover?</summary>
                <p>
                  The fee covers producing one estimate for one vehicle and
                  damage assessment. It is separate from the repair costs in
                  your report. Viewing and downloading the purchased report does
                  not create a new estimate charge.
                </p>
              </details>
            </div>
          </section>
          <section className="last-cta">
            <div>
              <h2>Take the guesswork out of what’s next.</h2>
              <p>Start with your photos. Get a little more clarity.</p>
            </div>
            <a href="/jobs/new" className="btn">
              Get my estimate <span>↗</span>
            </a>
          </section>
          <footer>
            <div className="footer">
              <div>
                <a className="brand" href="/">
                  <span style={{ color: "var(--green)", fontSize: "22px" }}>
                    ◈
                  </span>{" "}
                  repairestimator
                </a>
                <p>A clearer starting point for vehicle repairs.</p>
              </div>
              <div className="footer-links">
                <a href="#how-it-works">How it works</a>
                <a href="#pricing">Pricing</a>
                <a href="#faqs">FAQs</a>
                <a href="/login">Log in ↗</a>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© 2026 AI Repair Estimator</span>
              <span>
                Indicative estimates. A physical inspection may be required.
              </span>
            </div>
          </footer>
        </div>
      </main>

      <dialog
        id="sample-dialog"
        ref={sampleRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const r = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              event.currentTarget.close();
          }
        }}
      >
        <button
          className="close"
          onClick={() => sampleRef.current?.close()}
          aria-label="Close sample"
        >
          ×
        </button>
        <div className="eyebrow">
          <span className="dot"></span> EXAMPLE REPORT
        </div>
        <h2>What’s behind the range?</h2>
        <p>
          This illustrative bumper repair includes NZ$800 in labour, paint and
          small parts, plus NZ$120 GST. An example range of NZ$850–$1,200 allows
          for uncertainty.
        </p>
        <p>
          The real report should explain which findings are visible, what is
          assumed and what needs workshop inspection. These figures do not
          assess your vehicle.
        </p>
        <button
          className="btn dark dismiss"
          onClick={() => sampleRef.current?.close()}
        >
          Got it <span>✓</span>
        </button>
      </dialog>
    </div>
  );
}
