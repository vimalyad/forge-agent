export class ScalerPageFactory {
  create(blueprint: string): string {
    const details = this.extractDetails(blueprint);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scaler Academy - ${details.title}</title>
  <style>
    :root {
      --blue: #0057ff;
      --blue-dark: #003fb8;
      --navy: #07142f;
      --navy-soft: #11244d;
      --ink: #101828;
      --muted: #667085;
      --line: #d9e2f2;
      --surface: #f5f8ff;
      --white: #ffffff;
      --green: #00b386;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      color: var(--ink);
      background: var(--white);
      line-height: 1.5;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(255, 255, 255, 0.96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(14px);
    }

    .nav {
      max-width: 1180px;
      margin: 0 auto;
      min-height: 72px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 22px;
      color: var(--blue);
      letter-spacing: 0;
    }

    .brand-mark {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      background: linear-gradient(135deg, var(--blue), #38bdf8);
      display: grid;
      place-items: center;
      color: var(--white);
      font-weight: 900;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 22px;
      font-size: 14px;
      font-weight: 700;
      color: #344054;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .login {
      font-weight: 700;
      color: var(--blue);
    }

    .button {
      border: 0;
      border-radius: 7px;
      padding: 12px 18px;
      background: var(--blue);
      color: var(--white);
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 12px 22px rgba(0, 87, 255, 0.22);
    }

    .button.secondary {
      background: var(--white);
      color: var(--blue);
      border: 1px solid rgba(255, 255, 255, 0.62);
      box-shadow: none;
    }

    .menu {
      display: none;
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--white);
      color: var(--ink);
      font-size: 22px;
    }

    .hero {
      background:
        radial-gradient(circle at 78% 14%, rgba(56, 189, 248, 0.42), transparent 26%),
        linear-gradient(135deg, var(--navy), #0b2f78 52%, var(--blue));
      color: var(--white);
      padding: 74px 24px 42px;
    }

    .hero-inner {
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      gap: 54px;
      align-items: center;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      font-size: 13px;
      font-weight: 800;
      color: #dbeafe;
      margin-bottom: 22px;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(40px, 5vw, 68px);
      line-height: 1.02;
      letter-spacing: 0;
      max-width: 780px;
    }

    .hero p {
      margin: 22px 0 0;
      max-width: 660px;
      font-size: 19px;
      color: #d8e6ff;
    }

    .hero-actions {
      margin-top: 32px;
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    .hero-panel {
      background: rgba(255, 255, 255, 0.98);
      color: var(--ink);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.24);
    }

    .panel-title {
      font-size: 15px;
      color: var(--muted);
      font-weight: 800;
      margin: 0 0 18px;
    }

    .track {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      margin-top: 12px;
      display: grid;
      gap: 6px;
      background: linear-gradient(180deg, #ffffff, #f8fbff);
    }

    .track strong {
      color: var(--navy);
      font-size: 17px;
    }

    .track span {
      color: var(--muted);
      font-size: 14px;
    }

    .stats {
      max-width: 1180px;
      margin: -28px auto 0;
      padding: 0 24px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      position: relative;
      z-index: 2;
    }

    .stat {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 18px 40px rgba(16, 24, 40, 0.08);
    }

    .stat strong {
      display: block;
      font-size: 26px;
      color: var(--blue);
    }

    .stat span {
      color: var(--muted);
      font-weight: 700;
      font-size: 13px;
    }

    .section {
      max-width: 1180px;
      margin: 0 auto;
      padding: 78px 24px 0;
    }

    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 28px;
    }

    .section h2 {
      margin: 0;
      font-size: clamp(30px, 4vw, 46px);
      line-height: 1.1;
      color: var(--navy);
    }

    .section-head p {
      max-width: 460px;
      color: var(--muted);
      font-size: 17px;
      margin: 0;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
    }

    .card {
      min-height: 230px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--white);
      box-shadow: 0 12px 34px rgba(16, 24, 40, 0.07);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .card h3 {
      margin: 0 0 10px;
      color: var(--navy);
      font-size: 20px;
    }

    .card p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
    }

    .card a {
      margin-top: 20px;
      color: var(--blue);
      font-weight: 800;
    }

    .why {
      background: var(--surface);
      margin-top: 78px;
      padding: 76px 24px;
    }

    .why-inner {
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 0.9fr 1.1fr;
      gap: 40px;
      align-items: start;
    }

    .why-copy h2 {
      margin: 0 0 18px;
      font-size: clamp(32px, 4vw, 48px);
      color: var(--navy);
    }

    .why-copy p {
      color: var(--muted);
      font-size: 17px;
      margin: 0;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .feature {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 20px;
    }

    .feature b {
      display: block;
      color: var(--navy);
      font-size: 18px;
      margin-bottom: 8px;
    }

    .feature span {
      color: var(--muted);
      font-size: 15px;
    }

    .cta-band {
      max-width: 1180px;
      margin: 78px auto 0;
      padding: 42px;
      border-radius: 22px;
      color: var(--white);
      background: linear-gradient(135deg, var(--blue), var(--navy));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .cta-band h2 {
      margin: 0;
      font-size: 34px;
    }

    .cta-band p {
      margin: 10px 0 0;
      color: #dbeafe;
    }

    .footer {
      margin-top: 78px;
      background: var(--navy);
      color: #dbeafe;
      padding: 48px 24px;
    }

    .footer-inner {
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.4fr repeat(3, 1fr);
      gap: 28px;
    }

    .footer h3,
    .footer h4 {
      color: var(--white);
      margin: 0 0 12px;
    }

    .footer p,
    .footer a {
      color: #b8c7e8;
      font-size: 14px;
    }

    .footer a {
      display: block;
      margin: 8px 0;
    }

    @media (max-width: 920px) {
      .hero-inner,
      .why-inner,
      .footer-inner {
        grid-template-columns: 1fr;
      }

      .cards,
      .stats,
      .feature-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .nav-links,
      .nav-actions {
        display: none;
      }

      .menu {
        display: block;
      }

      .nav.open .nav-links,
      .nav.open .nav-actions {
        display: flex;
        position: absolute;
        left: 16px;
        right: 16px;
        top: 72px;
        background: var(--white);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px;
        flex-direction: column;
        align-items: flex-start;
      }

      .nav.open .nav-actions {
        top: 286px;
      }
    }

    @media (max-width: 620px) {
      .hero {
        padding-top: 48px;
      }

      .hero-actions,
      .cta-band {
        align-items: stretch;
        flex-direction: column;
      }

      .cards,
      .stats,
      .feature-grid {
        grid-template-columns: 1fr;
      }

      .section-head {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <nav class="nav" id="siteNav">
      <a class="brand" href="#"><span class="brand-mark">S</span>Scaler</a>
      <div class="nav-links">
        <a href="#programs">Programs</a>
        <a href="#why">Why Scaler</a>
        <a href="#stories">Stories</a>
        <a href="#placements">Placement Report</a>
        <a href="#resources">Resources</a>
      </div>
      <div class="nav-actions">
        <a class="login" href="#">Login</a>
        <a class="button" href="#callback">Request a Callback</a>
      </div>
      <button class="menu" type="button" aria-label="Toggle navigation">=</button>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-inner">
        <div>
          <div class="eyebrow">AI-integrated curriculum updated for today's market</div>
          <h1>${details.hero}</h1>
          <p>${details.description}</p>
          <div class="hero-actions">
            <a class="button" href="#programs">Explore Programs</a>
            <a class="button secondary" href="#callback">Book Free Live Class</a>
          </div>
        </div>
        <div class="hero-panel">
          <p class="panel-title">Choose a career track</p>
          <div class="track"><strong>Modern Software and AI Engineering</strong><span>DSA, system design, AI-assisted coding, and real projects.</span></div>
          <div class="track"><strong>Modern Data Science and ML</strong><span>Statistics, ML systems, GenAI workflows, and deployment.</span></div>
          <div class="track"><strong>DevOps, Cloud and AI Platform Engineering</strong><span>Cloud, CI/CD, reliability, and production AI platforms.</span></div>
        </div>
      </div>
    </section>

    <section class="stats" aria-label="Scaler outcomes">
      <div class="stat"><strong>4</strong><span>career-focused programs</span></div>
      <div class="stat"><strong>24x7</strong><span>AI companion for practice</span></div>
      <div class="stat"><strong>1:1</strong><span>mentor and career guidance</span></div>
      <div class="stat"><strong>Live</strong><span>classes, labs, and projects</span></div>
    </section>

    <section class="section" id="programs">
      <div class="section-head">
        <h2>Programs built for the next decade in AI</h2>
        <p>Scaler combines strong fundamentals with AI workflows, practical labs, and career support across software, data, AI, cloud, and DevOps.</p>
      </div>
      <div class="cards">
        <article class="card"><div><h3>Software and AI Engineering</h3><p>Master DSA, backend systems, LLD, HLD, and AI-assisted software delivery.</p></div><a href="#">View curriculum</a></article>
        <article class="card"><div><h3>Data Science and ML</h3><p>Build fluency in analytics, machine learning, experimentation, and GenAI systems.</p></div><a href="#">View curriculum</a></article>
        <article class="card"><div><h3>Advanced AI and Agentic AI</h3><p>Move from prompt usage to agents, retrieval, evaluations, and production AI apps.</p></div><a href="#">View curriculum</a></article>
        <article class="card"><div><h3>DevOps and AI Platforms</h3><p>Learn cloud infrastructure, automation, observability, and MLOps foundations.</p></div><a href="#">View curriculum</a></article>
      </div>
    </section>

    <section class="why" id="why">
      <div class="why-inner">
        <div class="why-copy">
          <h2>Built different, designed to last</h2>
          <p>Scaler focuses on durable engineering ability. The experience blends expert-led classes, hands-on projects, AI-enabled practice, and career accountability.</p>
        </div>
        <div class="feature-grid">
          <div class="feature"><b>AI-integrated curriculum</b><span>Every phase mirrors how modern teams frame, build, test, and ship with AI.</span></div>
          <div class="feature"><b>AI-powered platform</b><span>Practice with hints, critique, guided labs, and structured problem solving.</span></div>
          <div class="feature"><b>Lifelong learning access</b><span>Stay aligned as the market changes with refreshed content and sessions.</span></div>
          <div class="feature"><b>Mentor-led growth</b><span>Work with instructors, mentors, and career coaches through the journey.</span></div>
        </div>
      </div>
    </section>

    <section class="section" id="stories">
      <div class="section-head">
        <h2>Community, mentors, and placement support</h2>
        <p>From live classes to mock interviews, the experience is structured for consistent progress and job readiness.</p>
      </div>
      <div class="cards">
        <article class="card"><div><h3>Industry mentors</h3><p>Learn from experienced engineers and data leaders through classes and reviews.</p></div><a href="#">Meet mentors</a></article>
        <article class="card"><div><h3>Peer community</h3><p>Join ambitious learners solving assignments, discussing systems, and building projects.</p></div><a href="#">Join community</a></article>
        <article class="card"><div><h3>Placement readiness</h3><p>Prepare through resume reviews, mock interviews, referrals, and role-focused practice.</p></div><a href="#">See outcomes</a></article>
        <article class="card"><div><h3>Masterclasses</h3><p>Attend free live sessions on AI, software engineering, data, cloud, and career growth.</p></div><a href="#">Book a class</a></article>
      </div>
    </section>

    <section class="cta-band" id="callback">
      <div>
        <h2>Check how AI-ready your profile is</h2>
        <p>Get guidance on the right Scaler track and the skills you should build next.</p>
      </div>
      <a class="button secondary" href="#">Request a Callback</a>
    </section>
  </main>

  <footer class="footer" id="resources">
    <div class="footer-inner">
      <div>
        <h3>Scaler Academy</h3>
        <p>Professional upskilling programs for software, data, AI, cloud, and career growth.</p>
      </div>
      <div>
        <h4>Programs</h4>
        <a href="#">Software and AI Engineering</a>
        <a href="#">Data Science and ML</a>
        <a href="#">Advanced AI and Agentic AI</a>
      </div>
      <div>
        <h4>Explore</h4>
        <a href="#">Masterclass</a>
        <a href="#">Alumni Stories</a>
        <a href="#">Placement Report</a>
      </div>
      <div>
        <h4>Connect</h4>
        <a href="#">LinkedIn</a>
        <a href="#">YouTube</a>
        <a href="#">Instagram</a>
      </div>
    </div>
  </footer>

  <script>
    const menuButton = document.querySelector('.menu');
    const siteNav = document.querySelector('#siteNav');
    menuButton.addEventListener('click', () => {
      siteNav.classList.toggle('open');
    });
  </script>
</body>
</html>`;
  }

  private extractDetails(blueprint: string): { title: string; hero: string; description: string } {
    const title = blueprint.match(/title:\s*(.+)/i)?.[1]?.trim() || 'Professional AI and Software Programs';
    const hero = blueprint.match(/Become the Professional Built for the Next Decade in AI\.?/i)?.[0] || 'Become the Professional Built for the Next Decade in AI';
    const description = blueprint.match(/The investment that compounds\.[^.]+(?:\.[^.]+)?/i)?.[0]
      || 'Strong technical foundations, AI integrated at every stage, and a curriculum that evolves as the market does.';

    return { title, hero, description };
  }
}
