import type { DesktopPage } from "./AgentDesktop";
import "./QuoteWebsites.css";

export type QuoteField = { label: string; value: string; active: boolean; done: boolean };
type Props = { page: DesktopPage; fields: QuoteField[]; loading: boolean; ready: boolean };

// Only the data/typing primitive is shared. Each insurer owns its page composition.
function Field({ field }: { field: QuoteField }) {
  return <div className={`qw-field ${field.active ? "qw-active" : ""}`}><span className="qw-label">{field.label}</span><div className="qw-value"><span>{field.value || "\u00a0"}{field.active && <i className="qw-caret" />}</span>{field.done && <span className="qw-check">✓</span>}</div></div>;
}
function Fields({ fields, loading }: Pick<Props, "fields" | "loading">) {
  return <div className={`qw-fields ${loading ? "qw-loading" : ""}`} aria-label={loading ? "Loading insurer form" : "Home details"}>{fields.map((f) => <Field key={f.label} field={loading ? { ...f, value: "", active: false, done: false } : f} />)}</div>;
}
function DemoFooter() { return <footer className="qw-footer"><span>Home insurance</span><span>Privacy &nbsp; · &nbsp; Accessibility</span></footer>; }
function Price({ page, ready }: Pick<Props, "page" | "ready">) {
  return <div className="qw-price"><span>{ready ? page.result?.label ?? "Quote ready" : "Your home insurance quote"}</span><strong>{ready ? page.result?.value ?? "Ready for review" : "Calculating…"}</strong><small>Illustrative pricing · subject to confirmation</small></div>;
}

/** Progressive reference: centered headline, horizontal product selector, photo and overlapping quote panel. */
function ExplorerQuote(props: Props) {
  const { page, ready } = props;
  return <section className="qw-site qw-explorer" aria-label={`${page.site.name} website`}>
    <header className="qw-ex-header"><b>{page.site.name}</b><div>Insurance & more &nbsp; Claims &nbsp; Resources</div><span>Log in ↗</span></header>
    <div className="qw-ex-intro"><h3>Homeowners Insurance</h3><p>A place to call home. A policy to make it yours.</p></div>
    <div className="qw-ex-product"><div><small>PRODUCT</small><strong>⌂ &nbsp; Homeowners <span>⌄</span></strong></div><i>+</i><div><small>BUNDLE & SAVE</small><strong>Add auto <em>(optional)</em> <span>⌄</span></strong></div><span className="qw-ex-product-tag">Online quote</span></div>
    <div className="qw-ex-photo" role="img" aria-label="Family bringing groceries into their home" />
    <div className="qw-ex-application"><div className="qw-ex-form"><div className="qw-ex-section"><b>Let’s get to know your home</b><span>1 of 3</span></div><p>{page.note ?? "We’ll use these details to build your quote."}</p><Fields {...props} /></div><aside className="qw-ex-summary"><span className="qw-ex-home">⌂</span><Price page={page} ready={ready} /><span className="qw-action">{ready ? "View coverage" : "Continue"} →</span></aside></div>
    <div className="qw-ex-bottom"><b>EXPLORE HOMEOWNERS</b><span>Coverage &nbsp; / &nbsp; Discounts &nbsp; / &nbsp; FAQs</span><span>Continue a saved quote ↗</span></div><DemoFooter />
  </section>;
}

/** TD reference: utility strip, square monogram, two-tier navigation, green headings and orange action. */
function BankQuote(props: Props) {
  const { page, ready } = props;
  return <section className="qw-site qw-bank" aria-label={`${page.site.name} website`}>
    <div className="qw-bank-utility"><b>Personal Insurance</b><span>Business Insurance</span><span>About us</span></div>
    <header className="qw-bank-header"><div><b className="qw-bank-mark">C</b><strong>{page.site.name}</strong></div><span>Contact us &nbsp; EN ⌄ &nbsp; Login ⌄</span></header>
    <nav className="qw-bank-nav" aria-label="Insurer navigation"><span>Auto & Home ⌄</span><span>Life & Health ⌄</span><span>Support</span><b>Get a quote</b></nav>
    <div className="qw-bank-banner"><span>Home insurance / Online quote</span><h3>Let’s protect the place<br />you call home.</h3><p>Personalized coverage starts with your home’s details.</p></div>
    <div className="qw-bank-workspace"><aside className="qw-bank-steps"><b>Your home quote</b><span className="complete">✓ &nbsp; Getting started</span><span className={!ready ? "selected" : "complete"}>{ready ? "✓" : "2"} &nbsp; Your property</span><span className={ready ? "selected" : ""}>3 &nbsp; Your coverage</span><hr /><strong>Need a hand?</strong><p>Our insurance advisors can help you understand your options.</p><span className="qw-bank-help">Contact an advisor →</span></aside><div className="qw-bank-form"><h4>Tell us about your property</h4><p>{page.note ?? "Please review the information below."}</p><Fields {...props} /><div className="qw-bank-next"><span>‹ Back</span><span className="qw-action">{ready ? "See your quote" : "Continue"} →</span></div></div></div>
    {ready && <div className="qw-bank-result"><span>✓ &nbsp; Your quote is ready</span><strong>{page.result?.value}</strong></div>}<DemoFooter />
  </section>;
}

/** State Farm reference: red agent-led header, breadcrumb, split hero, product tiles and pill-shaped action. */
function AgentQuote(props: Props) {
  const { page, ready } = props;
  return <section className="qw-site qw-agent" aria-label={`${page.site.name} website`}>
    <header className="qw-agent-header"><b><span>●</span> {page.site.name}</b><div>Insurance &nbsp; Claims &nbsp; Find an agent</div><strong>Log in</strong></header>
    <div className="qw-agent-crumb">Insurance &nbsp; › &nbsp; Homeowners insurance</div>
    <div className="qw-agent-hero"><div><h3>Here for your home.<br />Here for you.</h3><p>From the roof over your head to the things that make it yours. Let’s find your home’s protection.</p><div className="qw-agent-options"><span>◉ &nbsp; Homeowners</span><span>○ &nbsp; Auto + Home</span></div></div><div className="qw-agent-photo" role="img" aria-label="Family with a dog enjoying their patio" /></div>
    <div className="qw-agent-application"><div><h4>Start with the basics.</h4><p>{page.note ?? "Tell us a little about the home you want to insure."}</p><Fields {...props} /><div className="qw-agent-next"><span className="qw-action">{ready ? "Review your quote" : "Continue quote"}</span><span>Save and finish later</span></div></div><aside className="qw-agent-card"><span className="qw-agent-card-label">HOMEOWNERS</span><Price page={page} ready={ready} /><hr /><strong>A real conversation.<br />A little reassurance.</strong><p>An advisor can help you review coverage before you decide.</p><span className="qw-agent-link">Find a local agent →</span></aside></div><DemoFooter />
  </section>;
}

/** Lemonade reference: centered script wordmark, spacious serif headline, line-art scenery and pink CTA. */
function DirectQuote(props: Props) {
  const { page, ready } = props;
  return <section className="qw-site qw-direct" aria-label={`${page.site.name} website`}>
    <header className="qw-direct-header"><div>Renters &nbsp; Homeowners &nbsp; Pet</div><b>{page.site.name.split(" ")[0]}</b><span>My account</span></header>
    <div className="qw-direct-intro"><span>HOMEOWNERS INSURANCE</span><h3>Good things happen<br />under your roof.</h3><p>Let’s make sure they’re covered.</p></div>
    <div className="qw-direct-stage"><div className="qw-direct-art" aria-hidden="true" /><div className="qw-direct-form"><div className="qw-direct-conversation"><span>✳</span><p>{ready ? "Looking good. Here’s your quote." : "Hi! Tell us a little about your home."}</p></div><Fields {...props} />{ready ? <Price page={page} ready={ready} /> : <p className="qw-direct-hint">Your information is ready for review.</p>}<div className="qw-action">{ready ? "CHECK MY COVERAGE" : "LET’S DO THIS"}</div></div></div>
    <div className="qw-direct-bottom"><span>Simple questions.</span><span>Clear coverage.</span><span>A little peace of mind.</span></div><DemoFooter />
  </section>;
}

export default function QuoteWebsites(props: Props) {
  switch (props.page.site.style) {
    case "explorer": return <ExplorerQuote {...props} />;
    case "classic": return <AgentQuote {...props} />;
    case "direct": return <DirectQuote {...props} />;
    default: return <BankQuote {...props} />;
  }
}
