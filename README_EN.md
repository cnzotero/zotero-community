# Zotero Chinese Community (`zoterocn.org`) & Official Plugin Market

[简体中文](README.md) | **English**

An independent, community-run, non-official Chinese resource hub and open-source in-app **Plugin Market** for **Zotero 7, 8, 9, and 10**.

- **Website**: https://zoterocn.org/
- **Plugin Directory**: https://zoterocn.org/plugins
- **Official In-App Plugin (`zotero-community.xpi`)**: https://zoterocn.org/plugin
- **Open JSON Catalog**: https://zoterocn.org/data/catalog.json
- **Chinese CSL Styles Index**: https://zoterocn.org/data/styles.json

---

## What the Official Plugin Does (`plugin/`)

The **Zotero Chinese Community Plugin (`Zotero中文社区`, MIT License)** adds a clean, neutral in-app **Plugin Market** button to Zotero 7–10's toolbar:

- **Browse & Search**: Search 340+ active Zotero plugins by name, summary, or author, and filter by category or Zotero version compatibility.
- **Version-Aware Compatibility**: Defaults to showing plugins whose authors explicitly declared compatibility with your current Zotero major version (Zotero 7, 8, 9, or 10).
- **Transparent Source Verification**: Before installing or updating any third-party plugin, a confirmation dialog displays the plugin name, version, GitHub repository, and exact `.xpi` release URL. Nothing is installed without explicit user confirmation.
- **Strict Security & Zero Telemetry**:
  - Reads only the public catalog from `https://zoterocn.org/data/catalog.json`.
  - Allows `.xpi` installation strictly from official `https://github.com/<owner>/<repo>/releases/...` URLs matching the plugin's declared repository.
  - Verifies the downloaded `.xpi` add-on ID before completing installation.
  - Zero user tracking, zero account required, zero access to your Zotero library items or PDFs.

## Installation (Zotero 7–10)

1. Download `zotero-community.xpi` from [GitHub Releases](https://github.com/cnzotero/zotero-community/releases).
2. In Zotero, open **Tools → Plugins** → click the gear icon → **Install Plugin From File…** → select `zotero-community.xpi`.
3. Click the **Plugin Market** button next to the search box in the main library toolbar.

## Neutrality & Open Governance

- All plugins in the directory follow one uniform, automated set of inclusion, sorting, and delisting rules documented at [zoterocn.org/rules](https://zoterocn.org/rules).
- No paid placements, no promoted slots, and no hidden editorial overrides.
- All site code, inclusion/delisting automation, and `plugin/` source code (MIT License) are publicly auditable in this repository.

> Disclaimer: This is an independent community project with no affiliation to Zotero or the Corporation for Digital Scholarship.
