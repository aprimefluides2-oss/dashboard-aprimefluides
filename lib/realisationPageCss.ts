/**
 * CSS embarqué dans le `content` HTML envoyé à Django pour rendre les pages
 * /etudes-de-cas/<slug> identiques à l'aperçu page web (mockup validé
 * `mockups/realisation-demo.html`).
 *
 * Le template Django ne porte pas (encore) ces styles : pour ne pas dépendre
 * du backend, on injecte le `<style>` dans le HTML du contenu. Toutes les
 * classes ci-dessous (`content-block`, `info-box`, `checklist-box`,
 * `photo-grid`, `faq-block`, `resume-block`) sont déjà utilisées par
 * l'IA de génération SEO et par les helpers HTML côté app.
 *
 * Source de vérité : mockups/realisation-demo.html (sections .content-block
 * → .faq-block du bloc <style>). Garder synchronisé manuellement.
 */
export const REALISATION_PAGE_STYLE = `<style>
:root {
  --ltdb-navy: #0e2a52;
  --ltdb-navy-light: #1a3a6b;
  --ltdb-orange: #e67e22;
  --ltdb-ink: #1e293b;
  --ltdb-muted: #5b6678;
  --ltdb-border: #e1e6ef;
}
.content-block {
  background: #fff;
  border: 1px solid var(--ltdb-border);
  border-radius: 12px;
  padding: 26px 28px;
  margin-bottom: 22px;
  box-shadow: 0 1px 3px rgba(14,42,82,.04);
  color: var(--ltdb-ink);
  line-height: 1.65;
}
.content-block h2 {
  margin: 0 0 16px;
  font-size: 21px;
  color: var(--ltdb-navy);
  padding-bottom: 10px;
  border-bottom: 3px solid var(--ltdb-orange);
  display: inline-block;
}
.content-block h3 {
  margin: 20px 0 8px;
  font-size: 17px;
  color: var(--ltdb-navy-light);
}
.content-block p { margin: 10px 0; }
.content-block a {
  color: var(--ltdb-orange);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.content-block a:hover { border-bottom-color: var(--ltdb-orange); }
.content-block ul, .content-block ol { padding-left: 22px; margin: 10px 0; }
.content-block li { margin: 4px 0; }

.resume-block {
  background: #fff7ef;
  border: 1px solid #f3d9bd;
  border-left: 5px solid var(--ltdb-orange);
}
.resume-block h2 { border-bottom-color: #f3d9bd; }

.info-box {
  background: #e9f2fb;
  border-left: 4px solid #2980b9;
  border-radius: 8px;
  padding: 16px 20px;
  margin: 18px 0;
}
.info-box strong { color: #1f5f8b; }
.checklist-box {
  background: #e9f6ee;
  border-left: 4px solid #1e8449;
  border-radius: 8px;
  padding: 16px 20px;
  margin: 18px 0;
}
.checklist-box ul { margin: 6px 0; padding-left: 22px; }
.checklist-box li { margin: 4px 0; }

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.photo-card {
  margin: 0;
  border: 1px solid var(--ltdb-border);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.photo-card img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}
.photo-card figcaption {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--ltdb-muted);
  background: #fafbfc;
}

.faq-block { padding-bottom: 14px; }
.faq-item {
  border: 1px solid var(--ltdb-border);
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
  background: #fafbfc;
}
.faq-item summary {
  cursor: pointer;
  padding: 15px 20px;
  font-weight: 700;
  color: var(--ltdb-navy);
  list-style: none;
  position: relative;
  padding-right: 44px;
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary::after {
  content: "+";
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 22px;
  font-weight: 400;
  color: var(--ltdb-orange);
  transition: transform .2s;
}
.faq-item[open] summary::after { transform: translateY(-50%) rotate(45deg); }
.faq-item[open] summary { background: #fff; border-bottom: 1px solid var(--ltdb-border); }
.faq-answer { padding: 4px 20px 16px; color: var(--ltdb-muted); }
.faq-answer p { margin: 10px 0 0; }

@media (max-width: 560px) {
  .content-block { padding: 20px; }
}
</style>`
