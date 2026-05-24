# 🧑‍🎨 Character Creator

> Build complete SillyTavern character cards with an LLM — fields, description, greetings, portraits, expression sprites and a voice sample — from a single idea or a guided form.

Character Creator turns a one-line idea (or a fully filled-out form) into a finished character card. The LLM writes the description, personality, scenario, first message, alternate greetings and message examples; your local **ComfyUI** instance generates the face / portrait / full-body images; an optional pass produces a full set of **28 expression sprites** for the Character Expressions extension; and a final optional pass generates a **voice sample** via Qwen3-TTS. Image generation reuses your existing **[AutoIllustrator](https://github.com/virgilianshailer/AutoIllustrator)** presets, so whatever workflow you already trust is the one that gets used here.

---

## Features

- **Two creation modes** — a one-box **Simple** mode (type an idea, get a full card) and a tabbed **Advanced** mode with granular fields across *Basic, Appearance, Mind, Clothing, Abilities* and *Card*
- **Per-tab and per-field generation** — generate one tab at a time, fill every field at once, or enhance a single field; the LLM keeps everything consistent with what you already wrote
- **🔒 Field & section locking** — lock any field (or a whole section) and the LLM treats it as fixed context it must respect, so regenerating the rest never overwrites your choices
- **Reference image support** — upload a reference image, have the LLM describe it, and optionally feed it into your image workflow as the character's visual anchor
- **Image generation via ComfyUI** — produce a **Face (1:1)**, **Portrait (3:4)** and **Full Body (2:3)** image; pick which one becomes the card avatar
- **🎭 Expression sprites** — generate a complete 28-emotion sprite sheet (admiration → surprise) for the Character Expressions extension, with a review grid to regenerate individual emotions and add variants before uploading
- **🔌 AutoIllustrator integration** — image and sprite generation run through your saved AutoIllustrator workflow presets; no separate workflow to maintain
- **Choice of emotion engine** — use the built-in **Flux 2 Klein** expression workflow *or* drive sprites through any AutoIllustrator preset you've set up
- **🔊 Voice sample** — generate a short spoken sample for the character through a Qwen3-TTS ComfyUI workflow, auto-converted to a clean 16-bit PCM WAV
- **👕 Outfit system** — define multiple outfits (Everyday, Formal, …) with per-slot clothing, and choose which outfit drives the generated images
- **🌍 Built-in translation** — translate the whole panel into your SillyTavern UI language on the fly
- **📄 Template loading** — paste a template to steer the card's structure and tone
- **NSFW parameters** — an optional, off-by-default set of explicit body fields for adult cards
- **Right-drawer or center-modal** UI, plus a chat-bar button to open the panel

---

## Requirements

| Requirement | Notes |
| --- | --- |
| [SillyTavern](https://github.com/SillyTavern/SillyTavern) | Latest stable recommended |
| An LLM connection in SillyTavern | Used to write all card text via the quiet-generation API |
| [AutoIllustrator](https://github.com/virgilianshailer/AutoIllustrator) | Recommended — provides the ComfyUI workflow presets used for images and sprites |
| [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | Required only for image / sprite / voice generation (SwarmUI also works) |
| [Character Expressions](https://docs.sillytavern.app/extensions/expression-images/) | Target for the generated emotion sprites |

> Text generation works with just an LLM connection. Images, sprites and voice need a running ComfyUI and at least one configured workflow — easiest via an AutoIllustrator preset.

---

## Installation

1. Open SillyTavern → **Extensions** → **Install Extension**
2. Paste this repository URL and click Install:

```
https://github.com/virgilianshailer/character-creator
```

3. Reload the page — a **🧑‍🎨** button appears on the chat bar, and a **Character Creator** section appears in the Extensions settings

Or install manually:

```
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/virgilianshailer/character-creator
```

---

## Quick Start

1. Click the **🧑‍🎨** button on the chat bar to open the panel.
2. Stay in **Simple** mode, type a character idea (e.g. *"a weary desert cartographer who collects forgotten songs"*), and click **Generate**.
3. Review the result; switch to **Advanced** to tweak any tab, lock anything you want to keep, and regenerate the rest.
4. *(Optional)* Under **Image**, generate a Face / Portrait / Full Body and pick which one becomes the avatar.
5. *(Optional)* Tick **Generate Emotions** to produce the 28 expression sprites, then review and confirm the upload.
6. Click **Create** — the card is written to SillyTavern, ready to chat.

---

## Settings Reference

Found under **Extensions → Character Creator**.

| Setting | Default | Description |
| --- | --- | --- |
| **Enable** | on | Master on/off switch for the extension |
| **Show chat button** | on | Show/hide the 🧑‍🎨 button on the chat bar |
| **Panel Position** | Right Drawer | Open the panel as a right-side drawer or a center modal |
| **Enable image generation (ComfyUI)** | off | Reveal the image/sprite options and wire generation to ComfyUI |
| **Generate Face (1:1)** | on | Offer a square face close-up |
| **Generate Portrait (3:4)** | on | Offer a waist-up portrait |
| **Generate Full Body (2:3)** | on | Offer a full-body standing image |
| **Show NSFW parameters** | off | Reveal the optional explicit body fields in the form |
| **Emotions Model / Workflow** | Flux 2 Klein | The engine used for expression sprites — a built-in workflow or one of your AutoIllustrator presets |
| **Image AI Preset** | active preset | Which AutoIllustrator preset drives the Face / Portrait / Full Body images |

### Emotions Model / Workflow

The expression-sprite dropdown is split into two groups:

- **Built-in workflow** — **Flux 2 Klein (4B)**: a native image-edit pipeline that gives the best identity consistency across all 28 expressions. It feeds the avatar through a `ReferenceLatent` and removes the background with **SwarmRemBg**. Requires the Flux 2 Klein 4B model (`flux-2-klein-4b-fp8`), the Qwen3-4B text encoder (`qwen_3_4b`), the Flux 2 VAE, and the Swarm nodes (`SwarmKSampler`, `SwarmLoadImageB64`, `SwarmRemBg`) in your ComfyUI.
- **AutoIllustrator presets** — your own saved workflows, for anything other than Flux 2 Klein (SDXL, Illustrious, Pony, etc.). The character avatar is fed into the preset's reference-image slot and the emotion is sent as the prompt. For consistent sprites the preset should:
  - support **background removal** (e.g. a `SwarmRemBg` node), and
  - use an **Edit model** (Flux Kontext / Klein, Qwen-Edit) or at least an **IP-Adapter** mode — otherwise each sprite drifts into a different-looking character.

Use the 🔄 button next to the dropdown to refresh the preset list after adding presets in AutoIllustrator.

---

## How It Works

```
Idea or form input
        ↓
LLM writes the card (description, personality, scenario,
   first message, alt greetings, message examples) — respecting locked fields
        ↓
(optional) ComfyUI generates Face / Portrait / Full Body via your AutoIllustrator preset
        ↓
(optional) Chosen avatar → 28 emotion prompts → ComfyUI → background-removed sprites
        ↓
Review grid: regenerate any emotion, add variants → upload to the character's expressions
        ↓
(optional) Qwen3-TTS workflow → spoken sample → 16-bit PCM WAV
        ↓
Card written to SillyTavern via /api/characters/create
```

The avatar you select feeds the sprite pass as the identity reference, which is why an Edit-model or IP-Adapter workflow matters: it keeps all 28 expressions on-model.

---

## Expression Sprites

When **Generate Emotions** is enabled, after the avatar is ready the extension generates one sprite per emotion for the full **Character Expressions** label set:

```
admiration · amusement · anger · annoyance · approval · caring · confusion ·
curiosity · desire · disappointment · disapproval · disgust · embarrassment ·
excitement · fear · gratitude · grief · joy · love · nervousness · neutral ·
optimism · pride · realization · relief · remorse · sadness · surprise
```

A review modal shows every result in a grid before anything is uploaded:

- **Regenerate** any individual emotion that came out wrong
- **Add / remove variants** per emotion (e.g. `joy`, `joy-1`, `joy-2`)
- **Confirm & Upload** sends the approved set to the character's `expressions` folder

Every sprite has its background removed so it composites cleanly over chat backgrounds.

---

## Voice Sample

The optional voice pass asks the LLM for a short voice description, a line to speak and delivery instructions, then runs a **Qwen3-TTS** workflow in ComfyUI. The raw audio is decoded and re-encoded to a **24 kHz mono 16-bit PCM WAV** in the browser so it drops straight into a TTS reference slot. A random TTS preset is picked per generation for variety.

> The voice pass expects the Qwen3-TTS nodes (`Qwen3TTSVoiceDesignerNode`, `Qwen3TTSEngineNode`) and `MediaUtilities_SaveAudio` to be available in your ComfyUI install.

---

## Field & Section Locking

Every generatable field carries a 🔒 toggle, and section headers have one too. A locked field is never overwritten by *Generate All Fields*, *Generate This Tab* or *Enhance* — instead its current value is passed to the LLM as fixed context, so the rest of the card is written *around* it. This makes it easy to nail down a name, race or body type and let the model fill in everything that should match.

---

## Troubleshooting

**Card text isn't generating**

- Make sure an LLM is connected in SillyTavern (the panel uses the quiet-generation API). The status bar reports `LLM generation not available.` when there's no connection.

**"No AutoIllustrator preset configured."**

- Image and sprite generation need a workflow. Install **AutoIllustrator**, create a preset there, then pick it under **Image AI Preset** (and, for sprites, in the **Emotions Model / Workflow** dropdown if you want a preset rather than a built-in).

**Sprites look like different characters**

- Switch the emotion engine to **Flux 2 Klein** (built-in) or to an AutoIllustrator preset that uses an **Edit model** or **IP-Adapter**. Plain text-to-image workflows can't preserve identity across 28 prompts.

**Sprites still have a background**

- The built-in workflows include `SwarmRemBg`. If you use your own AutoIllustrator preset, add a background-removal node to it — Character Creator doesn't add one to external workflows.

**Emotion sprites didn't upload**

- Confirm the character was created first and that the **Character Expressions** extension is installed. Uploads target the character's `expressions` folder via `/api/sprites/upload`.

**Voice generation fails or returns nothing**

- Verify the Qwen3-TTS nodes and `MediaUtilities_SaveAudio` exist in ComfyUI and that the workflow runs there standalone.

**ComfyUI errors during image/sprite generation**

- Node/queue errors are surfaced in the status bar. Check that the model, VAE, sampler and CLIP names in your preset match what ComfyUI actually has loaded.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Character Creator is a third-party extension and is not affiliated with SillyTavern.*
