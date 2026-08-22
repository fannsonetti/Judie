# Graph Report - .  (2026-08-21)

## Corpus Check
- 127 files · ~50,178 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 754 nodes · 1703 edges · 40 communities (38 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Device Control Apps
- Activity Widgets
- NPM Dependencies
- Calendar Media Apps
- Conversation Engine
- Raspberry Pi Docs
- Tauri Bundle Config
- Slopbox Icons UI
- TypeScript Config
- Layout Smoke Tests
- Slop Widget Preview
- Intent Process Eggs
- Entity Extraction
- Slop Export Actions
- Slop Schema Sidebar
- App Shell Settings
- Assistant Context Types
- Utterance Normalize
- App Icon Assets
- Command Palette Gallery
- Slop Canvas Editor
- Rust Backend Lib
- Home Screen Chrome
- Tauri Capabilities
- Slop Schema Helpers
- Math Expression Parse
- Widget Grid Metrics
- Vite Node Config
- Mini Games RPS
- Widget Containers
- Pi Build Script
- Debug Toasts UI
- React Brand Mark
- Vite Brand Mark

## God Nodes (most connected - your core abstractions)
1. `useRoomStore` - 38 edges
2. `runIntent()` - 27 edges
3. `dispatch()` - 24 edges
4. `WidgetSize` - 22 edges
5. `WidgetCreatorApp()` - 21 edges
6. `useLayoutStore` - 21 edges
7. `filledSizes()` - 18 edges
8. `SlopDef` - 17 edges
9. `compilerOptions` - 16 edges
10. `useAssistantStore` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Judie` --semantically_similar_to--> `Judie`  [INFERRED] [semantically similar]
  README.md → .github/workflows/release.yml
- `Tauri brand mark: interlocking yellow and cyan arcs with dots on black` --semantically_similar_to--> `Shared Tauri desktop app icon design (yellow/cyan interlocking arcs, black square)`  [INFERRED] [semantically similar]
  public/tauri.svg → src-tauri/icons/icon.png
- `Judie` --semantically_similar_to--> `Judie`  [INFERRED] [semantically similar]
  index.html → README.md
- `Widget Creator` --semantically_similar_to--> `Widget Creator`  [INFERRED] [semantically similar]
  docs/widget-format.md → README.md
- `build-pi.sh` --semantically_similar_to--> `build-pi.sh`  [INFERRED] [semantically similar]
  docs/raspberry-pi.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tauri app icon size and platform export variants** — concept_tauri_app_icon_design, src_tauri_icons_icon, src_tauri_icons_32x32, src_tauri_icons_128x128, src_tauri_icons_128x128_2x, src_tauri_icons_storelogo, src_tauri_icons_square30x30logo, src_tauri_icons_square44x44logo, src_tauri_icons_square71x71logo, src_tauri_icons_square89x89logo, src_tauri_icons_square107x107logo, src_tauri_icons_square142x142logo, src_tauri_icons_square150x150logo, src_tauri_icons_square284x284logo, src_tauri_icons_square310x310logo [INFERRED 0.75]
- **Frontend/tooling brand logos bundled in public and assets** — concept_tauri_logo, concept_vite_logo, concept_react_logo, public_tauri, public_vite, src_assets_react [INFERRED 0.75]

## Communities (40 total, 2 thin omitted)

### Community 0 - "Device Control Apps"
Cohesion: 0.06
Nodes (51): RoutineSnap, TimerSnap, WeatherDay, LightsApp(), WeatherApp(), STATUS_LABEL, StatusBar(), ClimateWidget() (+43 more)

### Community 1 - "Activity Widgets"
Cohesion: 0.06
Nodes (45): ActionSource, ActivityWidget(), Props, SOURCE_LABEL, Ico(), ACTIONS, Props, QuickControlsWidget() (+37 more)

### Community 2 - "NPM Dependencies"
Cohesion: 0.04
Nodes (48): framer-motion, dependencies, framer-motion, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-autostart, @tauri-apps/plugin-opener (+40 more)

### Community 3 - "Calendar Media Apps"
Cohesion: 0.08
Nodes (32): CalendarApp(), dayHeading(), offsetFromToday(), startOfDay(), formatTime(), MediaApp(), SCENES, PurifierApp() (+24 more)

### Community 4 - "Conversation Engine"
Cohesion: 0.09
Nodes (35): converse(), isSelf(), personReply(), pick(), preferenceReply(), CAPABILITY_MIN, CONVERSATION_MIN, conversationBlocksCapability() (+27 more)

### Community 5 - "Raspberry Pi Docs"
Cohesion: 0.07
Nodes (37): 64-bit Raspberry Pi OS, Autostart, build-pi.sh, Judie, Performance Mode, Pi Mode, Prefer deb over AppImage, Raspberry Pi 3 (+29 more)

### Community 6 - "Tauri Bundle Config"
Cohesion: 0.05
Nodes (36): https://github.com/fannsonetti/Nova/releases/latest/download/latest.json, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, msi, nsis (+28 more)

### Community 7 - "Slopbox Icons UI"
Cohesion: 0.12
Nodes (20): CanvasActions, iconPaths(), SLOP_ICONS, SlopIcon(), SlopIconName, hasFill(), hasText(), SlopInspector() (+12 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.08
Nodes (24): DOM, DOM.Iterable, ES2020, src, src/__tests__, compilerOptions, allowImportingTsExtensions, isolatedModules (+16 more)

### Community 9 - "Layout Smoke Tests"
Cohesion: 0.16
Nodes (19): packed, packed2, reordered, widgets, Props, Props, WidgetGrid(), createId() (+11 more)

### Community 10 - "Slop Widget Preview"
Cohesion: 0.19
Nodes (18): Props, SlopWidget(), Props, Props, FILL, Props, LayerProps, SlopLayer() (+10 more)

### Community 11 - "Intent Process Eggs"
Cohesion: 0.20
Nodes (19): EGGS, tryEasterEgg(), resolveScene(), alreadyPower(), fail(), followUp(), heuristic(), isQuestion() (+11 more)

### Community 12 - "Entity Extraction"
Cohesion: 0.18
Nodes (19): cleanEntity(), durationAmount(), Entities, extractEntities(), namedPerson(), NUMBER_WORDS, parseDuration(), parseDelayed() (+11 more)

### Community 13 - "Slop Export Actions"
Cohesion: 0.20
Nodes (19): bringToFront(), deleteSelected(), duplicateSelected(), sendToBack(), downloadText(), exportHookCode(), hookComment(), LEGACY_WIDGET_FORMAT (+11 more)

### Community 14 - "Slop Schema Sidebar"
Cohesion: 0.22
Nodes (15): createId(), defaultNode(), emptyLayouts(), filledSizes(), fitTextNode(), isTextLike(), measureTextPx(), Props (+7 more)

### Community 15 - "App Shell Settings"
Cohesion: 0.19
Nodes (13): App(), HomeScreen(), SettingsOverlay(), Tab, getConversationLogPath(), bootLifecycle(), bootPerformance(), looksLikePiClass() (+5 more)

### Community 16 - "Assistant Context Types"
Cohesion: 0.13
Nodes (17): applyContextFromResult(), rememberUtterance(), CalendarSnap, ClauseResult, ClimateSnap, CONTEXT_TTL_MS, ConversationContext, emptyContext() (+9 more)

### Community 17 - "Utterance Normalize"
Cohesion: 0.18
Nodes (17): CONTRACTIONS, hasAnaphora(), isWakeOnly(), normalizeUtterance(), splitClauses(), stripFluff(), contextFresh(), dispatch() (+9 more)

### Community 18 - "App Icon Assets"
Cohesion: 0.14
Nodes (17): Shared Tauri desktop app icon design (yellow/cyan interlocking arcs, black square), Tauri brand mark: interlocking yellow and cyan arcs with dots on black, Tauri logo SVG (yellow/cyan interlocking arcs with center dots), App icon 128x128 PNG (Tauri mark on black), App icon 128x128@2x PNG (Tauri mark on black, retina), App icon 32x32 PNG (Tauri mark on black), Primary app icon.png (Tauri mark on black), Windows Square107x107Logo PNG (Tauri mark on black) (+9 more)

### Community 19 - "Command Palette Gallery"
Cohesion: 0.17
Nodes (13): Hit, DESCRIPTIONS, Sel, SIZE_ASPECT, SIZE_LABEL, LayoutState, ExpandableWidgetType, GRID_COLS (+5 more)

### Community 20 - "Slop Canvas Editor"
Cohesion: 0.20
Nodes (13): novaPagePad(), guidesFor(), Handle, nudgeSelected(), pctPoint(), SlopCanvas(), ContextMenu(), MenuItem (+5 more)

### Community 21 - "Rust Backend Lib"
Cohesion: 0.31
Nodes (13): AppHandle, Option, PathBuf, Result, append_conversation_log(), conversation_log_path(), get_system_status(), log_file() (+5 more)

### Community 22 - "Home Screen Chrome"
Cohesion: 0.28
Nodes (9): CommandPalette(), EditModeControls(), ExpandedOverlay(), HomePage(), PageIndicator(), Props, WidgetCreatorOverlay(), WidgetGallery() (+1 more)

### Community 23 - "Tauri Capabilities"
Cohesion: 0.15
Nodes (12): autostart:allow-enable, autostart:allow-is-enabled, core:default, main, opener:default, process:default, updater:default, description (+4 more)

### Community 24 - "Slop Schema Helpers"
Cohesion: 0.27
Nodes (10): clamp(), clampPct(), cloneLayouts(), KIND_DEFAULTS, nudgeNodePx(), SlopAlign, SlopValign, snapBoxToGrid() (+2 more)

### Community 25 - "Math Expression Parse"
Cohesion: 0.33
Nodes (9): formatNumber(), looksLikeMath(), NUMBER_WORDS, parseExpr(), replaceWords(), stripMathWrappers(), Tok, tokenize() (+1 more)

### Community 26 - "Widget Grid Metrics"
Cohesion: 0.22
Nodes (9): GridMetrics, NOVA_FRAME, NOVA_PAGE_TOP, NOVA_SAFE_BOTTOM, NOVA_STATUS_H, novaHomeGridMetrics(), novaShellSize(), PreviewHome() (+1 more)

### Community 27 - "Vite Node Config"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 28 - "Mini Games RPS"
Cohesion: 0.39
Nodes (7): beats(), cap(), EIGHT, GameState, pick(), RPS, tryGame()

### Community 29 - "Widget Containers"
Cohesion: 0.38
Nodes (5): EXPANDABLE, Props, WidgetContainer(), MediaWidget(), PlacedWidget

### Community 30 - "Pi Build Script"
Cohesion: 0.33
Nodes (5): CARGO_PROFILE_RELEASE_CODEGEN_UNITS, CARGO_PROFILE_RELEASE_LTO, CARGO_PROFILE_RELEASE_OPT_LEVEL, CARGO_PROFILE_RELEASE_STRIP, build-pi.sh script

### Community 31 - "Debug Toasts UI"
Cohesion: 0.53
Nodes (4): DebugPanel(), formatEntities(), Toasts(), useAssistantStore

## Knowledge Gaps
- **197 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useRoomStore` connect `Device Control Apps` to `Activity Widgets`, `Calendar Media Apps`, `App Shell Settings`, `Command Palette Gallery`, `Home Screen Chrome`, `Widget Containers`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `filledSizes()` connect `Slop Schema Sidebar` to `Device Control Apps`, `Slopbox Icons UI`, `Layout Smoke Tests`, `Slop Widget Preview`, `Slop Export Actions`, `Command Palette Gallery`, `Home Screen Chrome`, `Slop Schema Helpers`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `formatClock()` connect `Activity Widgets` to `Calendar Media Apps`, `Device Control Apps`, `Intent Process Eggs`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _197 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Device Control Apps` be split into smaller, more focused modules?**
  _Cohesion score 0.05868544600938967 - nodes in this community are weakly interconnected._
- **Should `Activity Widgets` be split into smaller, more focused modules?**
  _Cohesion score 0.05536723163841808 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._