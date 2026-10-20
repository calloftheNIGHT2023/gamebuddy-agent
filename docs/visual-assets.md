# Visual assets

Verified on 2026-10-20. These are original game-art sample scenes by **Kenney**, downloaded from the creator's freely available asset packs. They are not screenshots of Pokemon, League of Legends, or another licensed game, and should not be presented as footage from those games.

The production files below are byte-for-byte copies of each pack's `Sample.png`: no image generation, redrawing, cropping, resizing, or format conversion. Combined transfer size is **163,572 bytes (about 160 KiB)**. Keep the original scene files intact; the interface can choose its display crop with CSS.

| Runtime path | Artwork and suggested use | Author | Source and license | Actual dimensions | File size |
| --- | --- | --- | --- | --- | --- |
| `/images/pixel-overworld.png` | **Tiny Town (1.1)** — green overworld, village, castle and exploration; suggested for the main game-world feature | Kenney | [Original pack](https://kenney.nl/assets/tiny-town), CC0 1.0 Universal | 918 x 515 px | 112,122 bytes |
| `/images/pixel-tactics.png` | **Tiny Battle (1.0)** — opposing teams, terrain, routes and tactical decisions; suggested for strategy and match review | Kenney | [Original pack](https://kenney.nl/assets/tiny-battle), CC0 1.0 Universal | 918 x 515 px | 24,931 bytes |
| `/images/pixel-dungeon.png` | **Tiny Dungeon (1.0)** — dungeon characters, equipment and combat; suggested for RPG progression and builds | Kenney | [Original pack](https://kenney.nl/assets/tiny-dungeon), CC0 1.0 Universal | 918 x 515 px | 26,519 bytes |

## Download provenance

Each public image was copied from `Sample.png` inside its respective original ZIP:

- Tiny Town: [creator-hosted ZIP](https://kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip). Original license retained at [`frontend/public/images/licenses/kenney-tiny-town.txt`](../frontend/public/images/licenses/kenney-tiny-town.txt).
- Tiny Battle: [creator-hosted ZIP](https://kenney.nl/media/pages/assets/tiny-battle/c1c25ac1f3-1691487575/kenney_tiny-battle.zip). Original license retained at [`frontend/public/images/licenses/kenney-tiny-battle.txt`](../frontend/public/images/licenses/kenney-tiny-battle.txt).
- Tiny Dungeon: [creator-hosted ZIP](https://kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip). Original license retained at [`frontend/public/images/licenses/kenney-tiny-dungeon.txt`](../frontend/public/images/licenses/kenney-tiny-dungeon.txt).

The source archives and inspection files are cached in the ignored `.runtime/visual-assets/` directory and are not required by the website.

## License and creator disclosure

All three individual source pages identify **Creative Commons CC0**; all three downloaded packs include a matching `License.txt`. [Kenney's own FAQ](https://kenney.nl/support) confirms that the game assets may be reused in commercial projects and that attribution is optional. [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) permits copying, modifying and redistributing the artwork. No donation, purchase, login, or additional permission was needed for these individual downloads.

The creator's [Tiny Battle listing](https://kenney-assets.itch.io/tiny-battle) and [Tiny Dungeon listing](https://kenney-assets.itch.io/tiny-dungeon) explicitly disclose that no generative AI was used. The creator's [All-in-1 collection listing](https://kenney.itch.io/kenney-game-assets), described as a collection of the freely available content, makes the same disclosure; its [2.8 changelog](https://kenney.itch.io/kenney-game-assets/devlog/877057/update-version-28) includes Tiny Town. The free individual packs were downloaded directly; the paid collection was not purchased or downloaded.

The original sample scenes include a creator mark and license strip near the bottom. These are creator attribution within the source image, not GameBuddy branding or an endorsement. [Kenney's FAQ](https://kenney.nl/support) reserves the Kenney logo for official projects; do not extract it or reuse it as a site logo. Optional plain-text credit: **Game artwork by Kenney (CC0)**.

## Design references

The interface uses a game-publication direction, informed by real non-AI websites inspected on 2026-10-20:

- [PC Gamer](https://www.pcgamer.com/): strong publication identity, distinct content sections and clear editorial hierarchy.
- [Backloggd](https://backloggd.com/): image-led game discovery, compact metadata and a focused game-library structure.
- [Playdate](https://play.date/): a specific, playful visual identity with game artwork and confident typography.

GameBuddy applies those ideas through a charcoal masthead, paper-colored workspace, citrus accents, scene-led game selection and numbered notes. The analysis, assistant and Ops surfaces remain working tools with real backend data. Reference-site logos, cover artwork, text and layouts were not copied into the project. Artwork credits are visible in each redesigned page footer. The six playable prototypes keep their original in-game interfaces.

Verification limit: the browser automation tool stopped because it could not reliably identify the current Windows browser URL. This revision is checked through TypeScript, lint, static export, asset inspection and live HTTP integration; a browser-rendered visual review is still needed.

Suggested Chinese alternative text:

- `pixel-overworld.png`: 像素风绿色原野、村庄与城堡地图。
- `pixel-tactics.png`: 两支队伍在河流、树林与道路之间进行战术部署。
- `pixel-dungeon.png`: 像素地下城中的战士、怪物、装备与房间。

## Integrity

SHA-256 values for the unchanged production PNGs:

```text
cb909e46bf51deb2906eeeb14b323aa42e861a738a734f449dc460ad682e4ccc  pixel-overworld.png
03d4fbcc8a1f08be69a642d6f6bbcd7c19abc6cf7bb7498a2236420f323ce6af  pixel-tactics.png
2b922fefcaa5728986e0b5c1fb901a51c3e571c39e6bed1a22fa1ffdf504370f  pixel-dungeon.png
```
