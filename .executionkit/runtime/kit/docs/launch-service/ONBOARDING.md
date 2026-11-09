# Add another Flutter application

1. Use its existing repository, application ID, Flutter pin and installed signing identity. Configure a unique registry ID, public/private artifact policy and actual required device gates. Do not copy FLOW credentials, cloud app ID or certificate. Register through project-scoped canonical API; null certificate blocks release until read-only installed-app attestation is reviewed.
2. Add a Git dependency on this repository's **exact published commit**, path `packages/global_mobile_updater`. Authenticate private Git access using the host's approved Git credential mechanism; no token appears in pubspec/lock.
3. Create UpdateConfig with the chosen HTTPS origin, project/package/channel and raw 32-byte Ed25519 public key. Use an UpdateController with app-owned `safeForInstall` and, for mutable data, an exclusive `acquireInstallGuard`. Render GlobalUpdateCard or use the headless controller to match the app's design. Arabic/English and light/dark inherit the consumer.
4. Protect in-flight mutations and durable queues; never clear local storage to make update testing pass. Keep app activation flag off until its actual signed native base containing the plugin/manifest is approved.
5. Register a separate Shorebird app locally with official CLI, record real ID, set `auto_update: false`, embed reviewed RSA public key. Select a Flutter pin actually supported by the installed Shorebird client; changing pin requires a native base.
6. Map an approved repository into a dedicated build worker config. Do not accept arbitrary repo paths/commands over the API. Run exact-source analyze/unit/widget gates, full signed APK, actual device lifecycle, staging and independent promotion.
7. Exercise an eligible Dart patch using real dry-run, staging, restart readback and rollback. Evidence must identify source/base/app/version/cert/device and test hashes.

`examples/sample_app` is the independent second consumer. Its standalone widget/unit tests and SDK reuse are verified locally. Native release/device/Shorebird tests remain required; synthetic sample acceptance never certifies FLOW production.
