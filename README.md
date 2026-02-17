<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy BUFSD MTSS Pulse (TanStack Start)

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js 22+

1. Install dependencies:
   `npm install`
2. Add your Gemini key to `.env.local`:
   `GEMINI_API_KEY=your_key_here`
3. Run the app:
   `npm run dev`

TanStack Start now serves both UI routes and API routes in one process.
Dev server is pinned to `http://localhost:3000` (`strictPort` enabled). If port `3000` is busy, stop the other process first and rerun.

## Migration Notes

- App framework: TanStack Start
- Routing: TanStack Router file-based routes under `src/routes`
- Query state: TanStack Query
- Table UI: TanStack Table (see `/roster-table`)
- API routes: Start server routes (including `/api/ai/*`)

## Quality Checks

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`
