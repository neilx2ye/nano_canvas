---
title: Gemini Image Generation Models — Capability & API Spec
version: 2026-04-20
purpose: |
  Machine-readable specification of Google's three Gemini image generation models
  (gemini-2.5-flash-image, gemini-3-pro-image-preview, gemini-3.1-flash-image-preview).
  Intended to be consumed by AI coding assistants to guide feature design, model
  selection, and request construction.
scope: |
  Covers: model IDs, shared API surface, per-model parameter differences,
  capability matrix, selection rules, request templates, and known limitations.
audience: AI coding assistant (used as reference context when implementing image generation features)
---

# Gemini Image Generation Models — Specification

## 1. Model Registry

| key | model_id | codename | generation | tier | status |
|---|---|---|---|---|---|
| `v25_flash` | `gemini-2.5-flash-image` | Nano Banana | 2.5 | Flash | GA |
| `v3_pro` | `gemini-3-pro-image-preview` | Nano Banana Pro | 3.0 | Pro | Preview |
| `v31_flash` | `gemini-3.1-flash-image-preview` | Nano Banana 2 | 3.1 | Flash | Preview |

**Default recommendation:** use `v31_flash` unless a rule in §6 routes to another model.

## 2. Shared API Surface

All three models use the same Gemini `generateContent` endpoint and SDK shape. Switching models = change `model` string + remove unsupported params.

### 2.1 Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent
Header: x-goog-api-key: $GEMINI_API_KEY
```

Also available via Vertex AI (`aiplatform.googleapis.com`, region-scoped).

### 2.2 Request skeleton

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "<instruction>" },
        { "inline_data": { "mime_type": "image/png", "data": "<base64>" } }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": {
      "aspectRatio": "<ratio>",
      "imageSize": "<size>"
    },
    "temperature": 1.0
  }
}
```

### 2.3 Invariant fields (identical across all 3 models)

- `contents.parts[].text` — natural-language instruction
- `contents.parts[].inline_data` — base64-encoded input image (mime: `image/png` | `image/jpeg` | `image/webp`)
- `generationConfig.responseModalities` — `["TEXT", "IMAGE"]` or `["IMAGE"]`
- `generationConfig.imageConfig.aspectRatio` — string enum (values differ per model, see §3)

### 2.4 Control paradigm (applies to all 3)

These models are **NOT** ControlNet-style. They have:

- ❌ No `seed`
- ❌ No `negative_prompt` field (put negatives in prompt text)
- ❌ No mask / inpaint field
- ❌ No `guidance_scale` / `control_strength`
- ❌ No LoRA / weight syntax

Control is achieved via:

- ✅ Natural-language instructions
- ✅ Multiple reference images (each assigned a role in the prompt text, e.g. "Image 1 is the product, Image 2 is the scene")
- ✅ Structured `imageConfig` for ratio/size
- ✅ Multi-turn conversation for iterative refinement

## 3. Per-Model Parameter Matrix

### 3.1 `aspectRatio`

| ratio | v25_flash | v3_pro | v31_flash |
|---|---|---|---|
| `1:1` | ✅ | ✅ | ✅ |
| `2:3` | ✅ | ✅ | ✅ |
| `3:2` | ✅ | ✅ | ✅ |
| `3:4` | ✅ | ✅ | ✅ |
| `4:3` | ✅ | ✅ | ✅ |
| `4:5` | ✅ | ✅ | ✅ |
| `5:4` | ✅ | ✅ | ✅ |
| `9:16` | ✅ | ✅ | ✅ |
| `16:9` | ✅ | ✅ | ✅ |
| `21:9` | ✅ | ✅ | ✅ |
| `1:4` | ❌ | ❌ | ✅ |
| `4:1` | ❌ | ❌ | ✅ |
| `1:8` | ❌ | ❌ | ✅ |
| `8:1` | ❌ | ❌ | ✅ |

**Count:** v25_flash=10, v3_pro=10, v31_flash=14.

### 3.2 `imageSize`

| value | v25_flash | v3_pro | v31_flash |
|---|---|---|---|
| *(param not supported)* | native 1024px | — | — |
| `"512"` | ❌ | ❌ | ✅ |
| `"1K"` | ❌ | ✅ default | ✅ default |
| `"2K"` | ❌ | ✅ | ✅ |
| `"4K"` | ❌ | ✅ | ✅ |

**Rules for Gemini 3 series:**
- Must use **uppercase** `K` (`1K`, `2K`, `4K`). Lowercase is rejected.
- `512` has no `K` suffix.
- Pricing scales: 2K = 1.5× base, 4K = 2× base, 512 = 0.75× base.

### 3.3 `thinking_level` / `thinking_config`

| model | support |
|---|---|
| `v25_flash` | ❌ — param causes error |
| `v3_pro` | ✅ — always thinking, no "off" mode |
| `v31_flash` | ✅ — configurable |

Values (where supported): `minimal` \| `low` \| `medium` \| `high`.

### 3.4 `thoughtSignature` (multi-turn edits)

| model | required on follow-up turns |
|---|---|
| `v25_flash` | ❌ not applicable |
| `v3_pro` | ✅ strict — missing → HTTP 400 |
| `v31_flash` | ✅ strict — missing → HTTP 400 |

On multi-turn edits for Gemini 3 models, the previous response's `thoughtSignature` must be included in the next request's parts, unchanged.

### 3.5 `font_inputs`

Custom font file upload for in-image typography.

| model | support |
|---|---|
| `v25_flash` | ❌ |
| `v3_pro` | ✅ |
| `v31_flash` | ✅ |

### 3.6 Reference image limit

| model | max input images |
|---|---|
| `v25_flash` | 3000 (hard cap), ≤ 7MB each. Practical: ≤ 5 |
| `v3_pro` | 14 recommended |
| `v31_flash` | 14 recommended |

### 3.7 Grounding tools

| tool | v25_flash | v3_pro | v31_flash |
|---|---|---|---|
| `google_search` grounding | ❌ | ✅ | ✅ |
| Search for Images (image-level grounding) | ❌ | ❌ | ✅ |

### 3.8 Native image segmentation (pixel-level masks)

| model | support |
|---|---|
| `v25_flash` | ✅ (requires thinking OFF) |
| `v3_pro` | ❌ |
| `v31_flash` | ❌ |

This is the **only** capability where `v25_flash` exceeds Gemini 3. Google official fallback for segmentation workloads: Gemini 2.5 Flash (thinking off) or Gemini Robotics-ER 1.6.

## 4. Capability Matrix (qualitative)

| capability | v25_flash | v3_pro | v31_flash |
|---|---|---|---|
| text rendering accuracy | ~70% (weak on small text, non-Latin scripts) | ~94% | ~90% |
| reasoning / complex instructions | low | highest | high |
| latency (1K image) | 1–2s | 8–12s | 4–6s |
| character consistency | usable | best | near-best |
| multi-image fusion | basic | best | near-best |
| max native resolution | 1024px | 4K | 4K |
| multilingual text in image | limited | strong | strong |
| real-world knowledge grounding | ❌ | ✅ | ✅ |
| free tier | ❌ | ❌ | ✅ (5000 prompts/month in AI Studio) |

## 5. Pricing (reference, USD, as of 2026-02)

| model | 1K image | 2K | 4K | notes |
|---|---|---|---|---|
| `v25_flash` | $0.039 | n/a | n/a | output tokens: $30 / 1M |
| `v3_pro` | $0.134 | $0.20 | $0.268 | premium tier |
| `v31_flash` | $0.067 | $0.10 | $0.134 | Batch API gives 50% off → ~$0.034 at 1K |

Prices evolve. Always verify against Google's current pricing page before production commitment.

## 6. Model Selection Rules (decision logic for AI)

Apply in order. First matching rule wins.

```
IF task requires pixel-level segmentation mask output:
    → v25_flash (with thinking=off)

ELIF task requires Google Search grounding for real-time facts (stock, weather, news):
    → v3_pro  (fallback: v31_flash)

ELIF task is brand-critical asset production (flagship visuals, multilingual headline typography,
     complex multi-element composition where text accuracy is business-critical):
    → v3_pro

ELIF task requires aspect ratio in {1:4, 4:1, 1:8, 8:1}
     (ultra-wide banners, ultra-tall scrolling layouts):
    → v31_flash  (only option)

ELIF task requires resolution = 512px (thumbnail, low-cost preview):
    → v31_flash  (only option)

ELIF task requires 2K or 4K output:
    → v31_flash  (cost-efficient default) OR v3_pro (if quality dominates)

ELIF task is high-volume batch generation, A/B testing, or cost-sensitive:
    → v31_flash

ELIF legacy system already on v25_flash and output quality is acceptable:
    → v25_flash  (no need to migrate unless adding new features)

ELSE (default):
    → v31_flash
```

## 7. Request Templates

### 7.1 Text-to-image (v31_flash, recommended default)

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="<prompt>",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="1K",
        ),
    ),
)
for part in response.parts:
    if img := part.as_image():
        img.save("out.png")
```

### 7.2 Image editing with reference (v31_flash)

```python
from PIL import Image

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[
        "Image 1 is the product. Image 2 is the target scene. "
        "Place the product from Image 1 into the scene from Image 2, "
        "matching lighting and perspective. Do not alter product geometry or logo.",
        Image.open("product.png"),
        Image.open("scene.jpg"),
    ],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="2K"),
    ),
)
```

### 7.3 Brand-critical asset (v3_pro)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="<complex prompt with multilingual text requirements>",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(aspect_ratio="3:4", image_size="4K"),
        # Pro is always in thinking mode; no thinking_level parameter needed
    ),
)
```

### 7.4 Legacy / segmentation (v25_flash)

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["<prompt>", Image.open("input.png")],
    config=types.GenerateContentConfig(
        response_modalities=['IMAGE'],
        image_config=types.ImageConfig(aspect_ratio="16:9"),
        # DO NOT pass image_size — not supported
        # DO NOT pass thinking_config — not supported
    ),
)
```

### 7.5 Multi-turn edit (Gemini 3 series — thoughtSignature handling)

```python
chat = client.chats.create(model="gemini-3.1-flash-image-preview")

# Turn 1
r1 = chat.send_message([
    "Generate a product hero shot of a blue ceramic mug on wooden table",
])

# Turn 2 — SDK auto-forwards thoughtSignature; on raw HTTP must pass manually
r2 = chat.send_message("Now change the mug color to forest green, keep everything else identical")
```

For raw HTTP: extract `thoughtSignature` from `r1.candidates[0].content.parts[*].thoughtSignature` and include in the next request's corresponding parts verbatim.

## 8. Cross-Model Migration Checklist

When switching model on existing code:

| source → target | action required |
|---|---|
| v25_flash → v31_flash | Add `image_size` param; optionally add `thinking_level`; handle `thoughtSignature` in multi-turn; check if any code relied on segmentation (not supported — fallback needed) |
| v25_flash → v3_pro | Same as above, plus higher latency budgets and higher cost per call |
| v31_flash → v3_pro | Remove `image_size="512"` (not supported); remove aspect ratios in {1:4, 4:1, 1:8, 8:1}; expect 2-3× latency |
| v3_pro → v31_flash | Safe downgrade path; all params remain valid; add `thinking_level` if you want to reduce latency further |
| any → v25_flash | Remove `image_size`, `thinking_*`, `thoughtSignature`, `font_inputs`; cap input images to practical ≤ 5; accept 1024px max output |

## 9. Known Gotchas

1. **Temperature:** Gemini 3 series default is `1.0`. Lower values may cause looping or degraded output. Don't carry over low-temperature config from text models.
2. **thoughtSignature is strictly validated** on Gemini 3 image models. Missing signature → HTTP 400. This differs from text models where it's only "degrading" to omit.
3. **`imageSize` typing:** strings, not integers. `"1K"` works, `1024` does not. Uppercase required.
4. **v25_flash aspect ratio drift:** even when set, output size may drift from input ratio in auto mode. For edits, add explicit instruction: *"Do not change the input aspect ratio."*
5. **No seed → no exact reproducibility.** For repeatable series, save a successful output as a reference image and feed it back as input.
6. **Preview status:** both Gemini 3 image models are in preview. API surface and limits can change. Always check the official model card before locking into production.
7. **Free tier only on v31_flash.** Budget accordingly when prototyping.
8. **Segmentation removed from Gemini 3.** If an existing pipeline depends on pixel masks, do not migrate that step from v25_flash.

## 10. Common Feature Patterns

Reference patterns for common product features, mapping to recommended model:

| feature pattern | recommended model | why |
|---|---|---|
| E-commerce product background swap (high volume) | v31_flash | cost + speed + 14 ratios |
| Multilingual ad banner with precise headline typography | v3_pro | text accuracy ~94% |
| Scrolling mobile banner (ultra-wide/tall) | v31_flash | only model supporting 1:4, 4:1, 1:8, 8:1 |
| Character-consistent IP series (e.g. mascot in many scenes) | v31_flash default; v3_pro for hero shots | consistency is strong on both; Pro for hero |
| Thumbnail preview at scale | v31_flash @ 512 | cheapest path |
| Print-grade poster | v3_pro @ 4K | resolution + text |
| Infographic with live data (weather, stock, recipe facts) | v3_pro or v31_flash | Search grounding required |
| Thumbnail + background-remove workflow (pixel mask needed) | v25_flash | only model with segmentation |
| Multi-reference compositing (up to 14 images) | v31_flash or v3_pro | input limit |
| Real-time user-facing editor (low latency required) | v31_flash | ~4-6s vs Pro's 8-12s |

## 11. Request Construction Helper (reference implementation)

```python
def build_request(task: dict) -> dict:
    """
    task = {
      "type": "generate" | "edit",
      "prompt": str,
      "reference_images": [bytes, ...],
      "aspect_ratio": str,
      "resolution": "512" | "1K" | "2K" | "4K" | None,
      "needs_grounding": bool,
      "needs_segmentation": bool,
      "text_critical": bool,
      "high_volume": bool,
    }
    returns: (model_id, request_payload)
    """
    # 1. Select model
    if task["needs_segmentation"]:
        model = "gemini-2.5-flash-image"
    elif task["text_critical"] or (task.get("resolution") == "4K" and not task["high_volume"]):
        model = "gemini-3-pro-image-preview"
    elif task["aspect_ratio"] in {"1:4", "4:1", "1:8", "8:1"} or task.get("resolution") == "512":
        model = "gemini-3.1-flash-image-preview"
    else:
        model = "gemini-3.1-flash-image-preview"  # default

    # 2. Build imageConfig
    image_config = {"aspectRatio": task["aspect_ratio"]}
    if model != "gemini-2.5-flash-image" and task.get("resolution"):
        image_config["imageSize"] = task["resolution"]

    # 3. Assemble
    return model, {
        "contents": [{"role": "user", "parts": _build_parts(task)}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": image_config,
        },
    }
```

## 12. References

- Gemini image generation docs: https://ai.google.dev/gemini-api/docs/image-generation
- Gemini 3 developer guide: https://ai.google.dev/gemini-api/docs/gemini-3
- Model cards:
  - https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview
  - https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview
- Vertex AI pages:
  - https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image
  - https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image
