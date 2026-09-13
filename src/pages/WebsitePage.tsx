import { Page, PageHeader, Card, Button } from "@/components/ui";

/**
 * Phase 4 will pull GA4 traffic (views, visitors, top pages) into this page via
 * the same GA4 Data API pattern the StatDoctor CRM uses (a Supabase Edge
 * Function with a Google service account writing daily snapshots). Until that is
 * wired, this links straight to the live Google Analytics property.
 */
export function WebsitePage() {
  return (
    <Page>
      <PageHeader title="Website" subtitle="Traffic and engagement for asme.org.au" />
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-wash text-brand-deep">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-ink">Website analytics — coming in Phase 4</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Live traffic charts (visitors, page views, top pages and sources) will appear here,
          pulled from Google Analytics 4. The site is already tracking with GA4
          (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">G-PGLKJQPWH5</code>). For now,
          open the full reports in Google Analytics.
        </p>
        <div className="mt-5">
          <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">
            <Button variant="primary">Open Google Analytics</Button>
          </a>
        </div>
      </Card>
    </Page>
  );
}
