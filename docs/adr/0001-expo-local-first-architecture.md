# Expo Local-First Architecture with On-Device SQLite

We chose **Expo (React Native + TypeScript)** paired with **`expo-sqlite`** for PennyWise's mobile application architecture. All financial data resides exclusively in an on-device SQLite database with zero mandatory cloud backend, guaranteeing user privacy ("data stays on device") and sub-second offline transaction entry while enabling high-fps interactive charts and cross-platform maintainability in TypeScript.
