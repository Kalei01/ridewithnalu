import { Link } from "@tanstack/react-router";

export function LegalFooter() {
  return (
    <footer className="mt-8 border-t border-white/8 pt-5 text-xs text-muted-foreground">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">Nalu</p>
          <p className="mt-1">Built for Oʻahu commuters.</p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          <Link to="/oahu-commute" className="hover:text-foreground">Oʻahu commute guide</Link>
          <Link to="/" className="hover:text-foreground">Open Nalu</Link>
        </nav>
      </div>
      <p className="mt-4 border-t border-white/8 pt-4">© 2026 Nalu. Information is provided for general commute planning purposes.</p>
    </footer>
  );
}
