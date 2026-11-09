---
name: flutter
description: Build and test Flutter widgets, offline-first sync, state management, and native behavior.
---

# Skill — Flutter, Offline Sync & Mobile Verification

1. Follow `design-system → component-system → premium-experience` and respect platform safe areas, system back navigation, text scaling, keyboard insets, and 60/120fps scroll budgets.
2. For offline-first features, implement durable local persistence, idempotent sync queues, deterministic conflict resolution, and explicit offline/reconnecting/sync-error UI states.
3. **Headless VPS Boundary:** Never run `flutter build apk|appbundle|ipa`, `./gradlew assemble*`, or emulators on a headless server. Verify locally using `flutter analyze`, `flutter test test/specific_test.dart`, `executionkit guard flutter .`, and `executionkit test task . --target <file>`; use `executionkit launch mobile .` on an enrolled workstation for native binary builds.
