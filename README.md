# HP-RTXC · five heat exchangers

[Open the demonstration](https://kopcaptz.github.io/hp-rtxc-5hx/) · [Animated HP01 cutaway](https://kopcaptz.github.io/hp-rtxc-5hx/index.html?view=cutaway3d) · [Engineer notes (Hebrew)](https://kopcaptz.github.io/hp-rtxc-5hx/review.html)

Hebrew browser demonstration of a Trane RTXC-inspired air-to-water heat pump and five water-to-water heat-exchanger modules. Independent concept, not an official Trane application. **Not a construction design, certified sizing tool, or live plant control system.**

## Contents

- `index.html`, `styles.css`, `src/`: existing main simulation, rooftop view, P&ID and scenarios.
- Integrated HP01 cutaway: 25 component cards, circuit/camera/casing controls, qualitative rotor/fan/flow animation, independent visual freeze and simulation pause.
- `cutaway.html`: compatibility redirect to the integrated cutaway.
- `review.html`: engineering limitations and source link.
- `vendor/three/`: the three runtime modules needed by the pages, with the original MIT license (three.js 0.186.1).

The calculation core is unchanged from the local source snapshot. The publication adapts static asset paths and adds navigation/disclosures only. Known Defrost refrigerant-cycle limitations remain; internal values are not validated OEM performance. A visually plausible model or a passing software test is not engineering approval.

No private review reports, agent prompts, automation files, site datasets, screenshots, OEM PDFs, credentials or local paths are included. Demo inputs are synthetic; SITE mode is an input template, not a real plant dataset.

## Local preview

Serve this directory with any static HTTP server, for example `python3 -m http.server 8092 --bind 127.0.0.1`, and open its URL. No backend or API key is needed. All WebGL dependencies are included locally.

## Publication policy

The owner authorizes publication to this demonstration repository and GitHub Pages. Subsequent worker updates may be published automatically **only after independent review and acceptance by Codex**. An executor delivery report alone is not acceptance. This permission does not authorize restarting monitoring, external worker dispatch, changing scope, or publishing private material.

The 2026-10-22 release includes the independently reviewed Package C/D integration and its accepted corrections. Motion is illustrative, not measured shaft speed or fluid velocity. Known model limitations remain. Review limitations before using any output. Future changes should identify accepted scope and checks in the commit message.

## Rights

Trane names are used to identify the reference equipment; trademarks belong to their owners. OEM documents are linked, not redistributed. The MIT license under `vendor/three/LICENSE` applies to that third-party library only. No broader open-source license is granted here for project code.
