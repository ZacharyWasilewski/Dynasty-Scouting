import Link from "next/link";
import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Privacy & Data Handling — Dynasty Database",
  description: "What Dynasty Database stores for accounts, saved research, league connections, and usage, and how sharing and deletion work.",
  alternates: { canonical: "https://dynastydatabase.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="py-10 sm:py-16">
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-semibold tracking-tightest text-ink">Privacy &amp; Data Handling</h1>
        <p className="mt-3 text-sm text-ink-tertiary">Updated September 19, 2026</p>
        <p className="mt-5 text-base leading-relaxed text-ink-secondary">This page describes how the Dynasty Database application handles information when you research prospects, create an account, and use saved tools.</p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink-secondary">
          <section>
            <h2 className="text-lg font-semibold text-ink">Accounts and saved research</h2>
            <p className="mt-2">We store your email address, a password hash, account creation time, and login sessions. We use these to sign you in and support account recovery. Your original password is not stored in the account database.</p>
            <p className="mt-2">When you use account features, we store your watchlist, custom board ordering and opportunity adjustments, completed saved mock drafts, league-format preferences, notification preferences, and relevant visit timestamps. These records allow your saved tools to work across visits.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Sleeper connections</h2>
            <p className="mt-2">Team Sync uses Sleeper&apos;s public API to look up leagues and rosters. Saved connections contain league and roster identifiers, league and team names, and timestamps. We retrieve roster and league information to calculate team needs and draft recommendations. Team Sync does not ask for or store your Sleeper password.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Cookies and browser storage</h2>
            <p className="mt-2">A session cookie keeps you signed in. Browser storage also remembers settings and working state, including league format, navigation state, and an in-progress mock draft. Some of this state is specific to your browser rather than saved to your account. Clearing site data can remove it and sign you out.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Usage information</h2>
            <p className="mt-2">The application records page paths, feature-event types, and timestamps to understand which tools are used. Events can be linked to your account while signed in; the admin dashboard summarizes usage. Page-view events older than 90 days are periodically pruned, rather than removed at an exact deadline. Other feature events can remain longer.</p>
            <p className="mt-2">Hosting and network services may also process technical request information, such as IP addresses, as part of delivering and protecting the site. Their operational logs and backups are separate from the application&apos;s saved account records.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Email and service providers</h2>
            <p className="mt-2">Password-recovery email and enabled watchlist notifications are delivered through Resend. Watchlist notifications are optional and can be turned off in My Stuff. Hosting, database, and email providers process information needed to operate these features. The site also loads public prospect data and images from external sources; requests to those services may include ordinary connection information.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Sharing</h2>
            <p className="mt-2">Using a board or mock-draft share link makes that shared content accessible to anyone who has the link. Only share research you are comfortable making accessible this way. Deleting your account removes its saved and shared records from the application database, but cannot remove screenshots or copies someone else has already made.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Your choices and deletion</h2>
            <p className="mt-2">You can manage saved research and notification preferences in <Link href="/my-stuff" className="text-accent underline">My Stuff</Link>. Its account-deletion control requires your password and permanently removes your account and linked saved records, including sessions, watchlist, boards, mock drafts, and saved Sleeper connections.</p>
            <p className="mt-2">Historical usage events remain with their account reference removed. Deletion does not promise immediate removal from provider backups, operational logs, or other browsers&apos; local storage. You can clear site data in those browsers separately.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Questions</h2>
            <p className="mt-2">For questions about your information or account, email <a href="mailto:dynastydatabase@gmail.com" className="break-words text-accent underline">dynastydatabase@gmail.com</a>. This page will be updated when the application&apos;s data handling changes.</p>
          </section>
        </div>
      </Container>
    </main>
  );
}
