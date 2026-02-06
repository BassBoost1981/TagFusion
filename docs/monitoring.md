# TagFusion Monitoring & Logging Concept

This document defines the strategy for observing the application's health and diagnosing issues.

## Logging Strategy

### 1. Backend (C# / Photino)
- **Current State:** Basic `Debug.WriteLine` and manual file logging in `ExifToolService`.
- **Target (ATLAS):** Implement `Microsoft.Extensions.Logging` with a rolling file provider (e.g., Serilog).
- **Log Levels:**
  - `Error`: Fatal errors, crashes, failed file writes.
  - `Warning`: ExifTool timeouts, missing files, access denied.
  - `Information`: App start, metadata sync completion, folder navigation.
  - `Debug`: Detailed ExifTool communication logs.

### 2. Frontend (React)
- **Strategy:** Use a centralized Logger utility that pipes to the browser console in development and sends "Critical" errors to the backend via the Bridge in production.

## Error Telemetry Strategy

Since TagFusion is a privacy-focused local desktop app, we avoid cloud-based telemetry (like Sentry) by default.

### 1. Local Error Reports
- **Mechanism:** On unhandled exception, the app should catch the error and offer to generate a `TagFusion_Report_[Date].zip` containing logs and system info.
- **Privacy:** All file paths in logs should be anonymized (masked) before sharing if the user chooses.

### 2. Heartbeat (Local)
- **Focus:** Monitoring the health of the persistent ExifTool process.
- **Metric:** Latency of a "ping" command (`exiftool -ver`) to detect hangs.

## Implementation Roadmap

1. [ ] Integrate Serilog in `Program.cs`.
2. [ ] Add `ILogger` to all core services.
3. [ ] Create a "Debug View" in the UI to see live logs.
