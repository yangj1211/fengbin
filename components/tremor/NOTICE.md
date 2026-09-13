# Tremor component source

Source: https://github.com/tremorlabs/tremor
Pinned revision: ca4d588f47820ff3d514d37fa4ee08a4222dec11
Upstream component version comments are retained in each file.
License: Apache-2.0; the complete upstream license and bundled notices are in LICENSE and public/licenses/tremor.txt.

These are locally maintained copies of Tremor's open-source, copy-and-paste components, not Tremor's paid blocks or an installation of its legacy npm package.

Local adaptations:

- Use the app's existing color tokens and lucide arrows.
- Adapt Recharts 3 / React 19 refs, tooltip payloads, and pie selection APIs.
- Use linear line interpolation, visible single/zero points, and no chart animation.
- Allow per-row bar warning colors and optional value labels; business callbacks only respond to data clicks.
- Supply semantic chart descriptions and Chinese tooltips at the application layer.
- Keep the existing data calculation, scope, filtering, and export code separate from rendering.
