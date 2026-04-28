# Nano Canvas

Nano Canvas is a local AI image canvas built with React, Vite, TypeScript, Tailwind CSS, and Fabric.js. It provides a lightweight browser interface for generating, editing, arranging, and archiving images with Google's Gemini image models under the Nano Banana naming used by the app.

## Features

- Infinite canvas for arranging generated images.
- Prompt-driven image generation with optional reference images.
- Model selection for Nano Banana, Nano Banana 2, and Nano Banana Pro.
- Aspect ratio, image size, and thinking-level controls where supported by the selected model.
- Mask-based local edit flow for models that support segmentation masks.
- Token usage display for the current session.
- Local API key storage in the browser.
- Project archive panel for saving and revisiting canvas work.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Fabric.js
- pnpm

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## API Key

The app calls the Google Gemini API directly from the browser. Paste your API key into the API Key panel in the left sidebar. The key is saved in local storage under `nano_api_key`.

## Project Structure

```text
src/
  components/     Reusable UI, canvas, prompt, settings, and control panels
  constants/      Gemini image model metadata and capability rules
  contexts/       Canvas, config, token, and project archive state
  pages/          Main application page
  services/       Gemini / Nano Banana API client
  types/          Shared TypeScript models
  utils/          Image, prompt, and token helpers
```

## Notes

- This is a local single-user app with no custom backend.
- API requests are sent from the browser to `https://generativelanguage.googleapis.com`.
- Generated content and API credentials should be handled according to the policies of the API key owner.
