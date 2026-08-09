# Privacy practices — dashboard answers

Paste-ready answers for the Chrome Web Store "Privacy practices" tab.

## Single purpose description

> Rabbit Hole Map visualizes the user's own browsing trail as an interactive
> map: pages become nodes, clicked links become edges, and the user can replay,
> arrange, and export the map. All data is stored locally and never transmitted.

## Permission justifications

**webNavigation**

> Used to observe page navigations (URL and transition type) so each visit can
> be added as a node, and each link click as an edge, in the user's locally
> stored browsing map. This is the extension's core function.

**tabs**

> Used to read tab URLs and titles to label nodes on the map, to detect which
> tab opened a new tab so cross-tab link trails stay connected, and to exclude
> Incognito tabs from recording entirely.

**storage**

> Used to save the recorded browsing sessions, user settings (domain
> blocklist), and per-tab bookkeeping locally on the user's device. Nothing is
> synced or transmitted.

**favicon**

> Used to display each site's favicon on its node in the map view.

## Data usage disclosures

- Collects **web history** (URLs/titles of visited pages) — stored **locally
  only**, never transmitted, never sold, not used for any purpose other than
  rendering the user's own map.
- Does **not** collect: personally identifiable information, health,
  financial, authentication, personal communications, location, user activity
  beyond the above, or website content.
- Remote code: **none**. All code ships in the package.

Certify: data is **not** sold, **not** used for unrelated purposes, **not**
used for creditworthiness/lending.
