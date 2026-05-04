export class FallbackPageFactory {
  create(blueprint: string): string {
    const details = this.extractDetails(blueprint);

    const navLinksHtml = details.navLinks.map(link => `<a href="#${link.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${link}</a>`).join('\n        ');
    
    let sectionsHtml = '';
    details.sections.forEach((section, index) => {
      const isAlt = index % 2 === 1;
      const sectionClass = isAlt ? 'section alt-bg' : 'section';
      
      const cardsHtml = section.items.map(item => `
        <article class="card">
          <div>
            <h3>${item}</h3>
            <p>Explore more details about this feature or offering.</p>
          </div>
          <a href="#">Learn more</a>
        </article>
      `).join('');

      sectionsHtml += `
    <section class="${sectionClass}">
      <div class="section-head">
        <h2>${section.heading}</h2>
        <p>Discover everything you need to know about our offerings.</p>
      </div>
      <div class="cards">
        ${cardsHtml}
      </div>
    </section>
`;
    });

    const footerColumnsHtml = details.footerColumns.map(col => `
      <div>
        <h4>Links</h4>
        ${col.map(link => `<a href="#">${link}</a>`).join('\n        ')}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${details.siteName}</title>
  <style>
    :root {
      --primary: ${details.primaryColor};
      --primary-dark: color-mix(in srgb, var(--primary) 80%, black);
      --navy: #07142f;
      --ink: #101828;
      --muted: #667085;
      --line: #d9e2f2;
      --surface: #f5f8ff;
      --white: #ffffff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      color: var(--ink);
      background: var(--white);
      line-height: 1.5;
    }

    a { color: inherit; text-decoration: none; }

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
      color: var(--primary);
    }

    .brand-mark {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      background: var(--primary);
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

    .nav-actions { display: flex; align-items: center; gap: 12px; }

    .login { font-weight: 700; color: var(--primary); }

    .button {
      border: 0;
      border-radius: 7px;
      padding: 12px 18px;
      background: var(--primary);
      color: var(--white);
      font-weight: 800;
      cursor: pointer;
    }

    .button.secondary {
      background: var(--white);
      color: var(--primary);
      border: 1px solid var(--primary);
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
      background: linear-gradient(135deg, var(--navy), var(--primary-dark), var(--primary));
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

    .hero h1 {
      margin: 0;
      font-size: clamp(40px, 5vw, 68px);
      line-height: 1.02;
    }

    .hero p {
      margin: 22px 0 0;
      max-width: 660px;
      font-size: 19px;
      color: rgba(255,255,255,0.8);
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
      background: linear-gradient(180deg, #ffffff, #f8fbff);
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
      color: var(--primary);
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

    .alt-bg {
      background: var(--surface);
      margin-top: 78px;
      padding: 76px 24px;
      max-width: none;
    }

    .section-head { margin-bottom: 28px; }

    .section h2 {
      margin: 0;
      font-size: clamp(30px, 4vw, 46px);
      color: var(--navy);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      max-width: 1180px;
      margin: 0 auto;
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
      color: var(--primary);
      font-weight: 800;
    }

    .cta-band {
      max-width: 1180px;
      margin: 78px auto 0;
      padding: 42px;
      border-radius: 22px;
      color: var(--white);
      background: linear-gradient(135deg, var(--primary), var(--navy));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .cta-band h2 { margin: 0; font-size: 34px; }

    .footer {
      margin-top: 78px;
      background: var(--navy);
      color: rgba(255,255,255,0.7);
      padding: 48px 24px;
    }

    .footer-inner {
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.4fr repeat(3, 1fr);
      gap: 28px;
    }

    .footer h3, .footer h4 { color: var(--white); margin: 0 0 12px; }

    .footer a { display: block; margin: 8px 0; }

    @media (max-width: 920px) {
      .hero-inner, .footer-inner { grid-template-columns: 1fr; }
      .cards, .stats { grid-template-columns: repeat(2, 1fr); }
      .nav-links, .nav-actions { display: none; }
      .menu { display: block; }
      .nav.open .nav-links, .nav.open .nav-actions {
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
      .nav.open .nav-actions { top: 286px; }
    }

    @media (max-width: 620px) {
      .hero-actions, .cta-band { flex-direction: column; align-items: stretch; }
      .cards, .stats { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <nav class="nav" id="siteNav">
      <a class="brand" href="#"><span class="brand-mark">${details.siteName.charAt(0)}</span>${details.siteName}</a>
      <div class="nav-links">
        ${navLinksHtml}
      </div>
      <div class="nav-actions">
        <a class="login" href="#">Login</a>
        <a class="button" href="#">Get Started</a>
      </div>
      <button class="menu" type="button" aria-label="Toggle navigation">=</button>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-inner">
        <div>
          <h1>${details.heroHeadline}</h1>
          <p>${details.heroSubtext}</p>
          <div class="hero-actions">
            <a class="button" href="#">Start Now</a>
            <a class="button secondary" style="color:var(--white); border-color:rgba(255,255,255,0.5)" href="#">Learn More</a>
          </div>
        </div>
        <div class="hero-panel">
          <p class="panel-title">Explore our offerings</p>
          ${details.navLinks.slice(0, 3).map(link => `<div class="track"><strong>${link}</strong></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="stats" aria-label="Quick facts">
      <div class="stat"><strong>Top</strong><span>Rated</span></div>
      <div class="stat"><strong>24/7</strong><span>Support</span></div>
      <div class="stat"><strong>1M+</strong><span>Users</span></div>
      <div class="stat"><strong>100%</strong><span>Secure</span></div>
    </section>

    ${sectionsHtml}

    <section class="cta-band">
      <div>
        <h2>Ready to dive in?</h2>
        <p>Join thousands of others today.</p>
      </div>
      <a class="button secondary" style="color:var(--navy); background:var(--white)" href="#">Get Started</a>
    </section>
  </main>

  <footer class="footer">
    <div class="footer-inner">
      <div>
        <h3>${details.siteName}</h3>
        <p>Built for the modern web.</p>
      </div>
      ${footerColumnsHtml}
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

  private extractDetails(blueprint: string) {
    const titleMatch = blueprint.match(/title:\s*(.+)/i);
    let siteName = 'My Application';
    if (titleMatch) {
      siteName = titleMatch[1].trim().replace(/\.(com|io|ai|co)$/i, '').split('|')[0].trim();
    }

    const colorMatch = blueprint.match(/#[0-9a-fA-F]{3,6}/);
    const primaryColor = colorMatch ? colorMatch[0] : '#2563EB';

    const navLines = blueprint.split('\n').filter(l => l.match(/^-\s+(link|a):/i));
    const navLinks = navLines.slice(0, 5).map(l => l.replace(/^-\s+(link|a):\s*/i, '').replace(/\s*->.*$/, '').trim());
    if (navLinks.length === 0) navLinks.push('Home', 'About', 'Services', 'Contact');

    const h1Match = blueprint.match(/-\s+h1:\s+(.+)/i);
    const heroHeadline = h1Match ? h1Match[1].trim() : `Welcome to ${siteName}`;

    const descMatch = blueprint.match(/description:\s*(.+)/i);
    const heroSubtext = descMatch ? descMatch[1].trim() : 'We provide the best services for your needs.';

    const sections: { heading: string, items: string[] }[] = [];
    const lines = blueprint.split('\n');
    let currentSection: { heading: string, items: string[] } | null = null;
    
    for (const line of lines) {
      const headingMatch = line.match(/^-\s+(h2|h3):\s+(.+)/i);
      if (headingMatch) {
        if (currentSection && currentSection.items.length > 0) {
          sections.push(currentSection);
          if (sections.length >= 3) break;
        }
        currentSection = { heading: headingMatch[2].trim(), items: [] };
      } else if (currentSection && line.startsWith('- ')) {
        const itemText = line.replace(/^-\s+[a-z]+:\s+/i, '').trim();
        if (itemText && currentSection.items.length < 4) {
          currentSection.items.push(itemText);
        }
      }
    }
    if (currentSection && currentSection.items.length > 0 && sections.length < 3) {
      sections.push(currentSection);
    }

    if (sections.length === 0) {
      sections.push({ heading: 'Our Features', items: ['Feature One', 'Feature Two', 'Feature Three', 'Feature Four'] });
      sections.push({ heading: 'Why Choose Us', items: ['Reason One', 'Reason Two', 'Reason Three', 'Reason Four'] });
    }

    const footerColumns: string[][] = [[], [], []];
    navLinks.forEach((link, i) => {
      footerColumns[i % 3].push(link);
    });

    return { siteName, primaryColor, navLinks, heroHeadline, heroSubtext, sections, footerColumns };
  }
}
