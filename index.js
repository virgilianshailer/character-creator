/*
 *  Character Creator v2.1 — SillyTavern Extension
 *  Create character cards via LLM with simple & advanced modes,
 *  image generation via ComfyUI (AutoIllustrator integration),
 *  template loading, clothing system, field locking, translation.
 *
 *  v2.1: Added Emotions sprite generation for Character Expressions extension.
 *  Supports: Flux 2 Klein, Illustrious/NoobAI, SD 1.5, SDXL
 */

/* ══════════════════════════════════════
   MODULE GLOBALS
   ══════════════════════════════════════ */

var CC_MODULE = 'character-creator';
var ccSettings = null;
var extSettings = null;
var saveFn = null;
var scriptModule = null;
var genQuiet = null;
var translateFn = null;

/* ── State ── */
var ccData = {
    mode: 'simple',
    activeTab: 'basic',
    simpleIdea: '',
    name: '', race: '', gender: '', age: '', weight: '', height: '',
    musculature: '', hairColor: '', hairstyle: '', eyeColor: '',
    bustSize: '',     buttocksSize: '', legLength: '',
    penisLengthErect: '', penisLengthFlaccid: '',
    penisGirthErect: '', penisGirthFlaccid: '',
    scrotumSize: '', ejaculationVolume: '', alignment: '', temperament: '', intelligence: '',
    memory: '', attention: '', logic: '', voiceTimbre: '',
    mentalHealth: '', diseases: '',
    appearanceDesc: '', personalityDesc: '', backstory: '',
    outfits: [
        { name: 'Everyday', head: '', glasses: '', torso: '', arms: '', legs: '', feet: '', underwear: '', accessories: '' },
        { name: 'Formal', head: '', glasses: '', torso: '', arms: '', legs: '', feet: '', underwear: '', accessories: '' }
    ],
    currentOutfitIdx: 0,
    weapon: '', abilities: '', languages: '', relationship: '',
    description: '', personality: '', scenario: '',
    firstMessage: '', altGreetings: [], mesExample: '',
    refImageBase64: null, refImageDesc: '',
    generatedPortraitBase64: null,
    generatedFaceBase64: null,
    generatedFullbodyBase64: null,
    templateText: '',
    locked: {},
	lockedSections: {},
    avatarSource: 'portrait',
    mainImageView: 'fullbody',
    generateEmotions: false,
	emotionVariantCount: 1,
	useRefAsCharAvatar: false,
    voiceDuration: 10,
    _translated: false, _trL: {}
};

var ccBusy = false;
var ccEmotionsCancelled = false;
// v2.2: Available TTS presets for randomization
var TTS_PRESETS = ['Ryan', 'Chelsie', 'Ethan', 'Olivia', 'Drake', 'Fiona', 'Nova', 'Adam', 'Bella', 'Chris'];

function L() { console.log.apply(console, ['[CC]'].concat(Array.from(arguments))); }
function E() { console.error.apply(console, ['[CC]'].concat(Array.from(arguments))); }
function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

/* ══════════════════════════════════════
   EMOTIONS — Constants & Workflow Templates
   ══════════════════════════════════════ */

var EMOTION_LABELS = [
    'admiration', 'amusement', 'anger', 'annoyance', 'approval',
    'caring', 'confusion', 'curiosity', 'desire', 'disappointment',
    'disapproval', 'disgust', 'embarrassment', 'excitement', 'fear',
    'gratitude', 'grief', 'joy', 'love', 'nervousness',
    'neutral', 'optimism', 'pride', 'realization', 'relief',
    'remorse', 'sadness', 'surprise'
];

var EMOTION_PROMPTS = {
    admiration: 'expression of pure admiration, looking with deep respect and wonder',
    amusement: 'expression of pure amusement, amused smile, entertained look',
    anger: 'expression of pure anger, angry face, furrowed brows, intense glare',
    annoyance: 'expression of absolute annoyance, irritated look, slight frown',
    approval: 'expression of pure approval, approving nod, warm accepting smile',
    // Added 'solo'; removed hints of interaction with another character
    caring: 'compassionate expression, gentle warm smile, soft kind eyes, solo',
    confusion: 'expression of pure confusion, totally confused, tilted head, puzzled look',
    curiosity: 'expression of pure curiosity, curious wide eyes, interested look',
    desire: 'expression of desire, longing look, slightly parted lips, intense gaze',
    disappointment: 'expression of pure disappointment, let down, sad subtle frown',
    disapproval: 'expression of pure disapproval, disapproving look, slight head shake',
    disgust: 'expression of absolute disgust, disgusted grimace, wrinkled nose',
    embarrassment: 'expression of pure embarrassment, deeply embarrassed, blushing, looking away',
    excitement: 'expression of pure excitement, massively excited, bright eyes, wide smile',
    fear: 'expression of pure fear, deeply scared, wide frightened eyes',
    gratitude: 'expression of absolute gratitude, super thankful, grateful warm smile',
    grief: 'expression of pure grief, grieving, tears in eyes, sorrowful',
    joy: 'expression of pure joy, overcome with joy, beaming happy smile',
    // Dropped 'heart-eyes' (causes artifacts/zoom); added 'solo' and a blush description instead of concrete objects
    love: 'lovestruck expression, blushing cheeks, soft adoring eyes, affectionate gentle smile, solo',
    nervousness: 'expression of absolute nervousness, suddenly very nervous, anxious look',
    neutral: 'expression of neutrality, completely neutral expression, calm composed face',
    optimism: 'expression of pure optimism, hopeful bright smile, positive look',
    pride: 'expression of pure pride, feeling very prideful, confident smirk',
    realization: 'expression of absolute realization, sudden understanding, eyes lighting up',
    // Added 'solo'; removed 'exhaling' (can produce smoke/artifacts); emphasis on a relaxed face
    relief: 'relieved expression, relaxed sigh, calm and content face, gentle smile, solo',
    remorse: 'expression of pure remorse, deeply regretful, guilty downcast eyes',
    sadness: 'expression of pure sadness, sad face, downturned lips, glistening eyes',
    surprise: 'expression of absolute surprise, look so surprised, wide open eyes and mouth'
};

/* ── Workflow builders for each model type ── */

function buildFluxEmotionWorkflow(avatarB64, emotionPrompt, seed) {
    // Mandatory tags for Flux to avoid clones and keep the composition
    // Flux is context-sensitive, so we explicitly add "solo" and "looking at viewer"
    var finalPrompt = 'full body shot, wide shot, ' + emotionPrompt + ', solo, single person, looking at viewer, detailed face, keeping original composition';

    return {
  "4": {
    "inputs": {
      "unet_name": "Flux2\\flux-2-klein-4b-fp8.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "5": {
    "inputs": {
      "width": [
        "107",
        0
      ],
      "height": [
        "107",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyFlux2LatentImage",
    "_meta": {
      "title": "Empty Flux 2 Latent"
    }
  },
  "6": {
    "inputs": {
      "text": finalPrompt, // Use the updated prompt with safety tags
      "clip": [
        "100",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "7": {
    "inputs": {
      "text": "", // Flux rarely needs a negative prompt, but "multiple people, couple" can go here if required
      "clip": [
        "100",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "10",
        0
      ],
      "vae": [
        "101",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "10": {
    "inputs": {
      "noise_seed": seed,
      "steps": 8,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "flux2",
      "start_at_step": 0,
      "end_at_step": 10000,
      "var_seed": 0,
      "var_seed_strength": 0,
      "sigma_max": -1,
      "sigma_min": -1,
      "rho": 7,
      "add_noise": "enable",
      "return_with_leftover_noise": "disable",
      "previews": "default",
      "tile_sample": false,
      "tile_size": 1024,
      "model": [
        "4",
        0
      ],
      "positive": [
        "104",
        0
      ],
      "negative": [
        "7",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "SwarmKSampler",
    "_meta": {
      "title": "SwarmKSampler"
    }
  },
  "100": {
    "inputs": {
      "clip_name": "qwen_3_4b.safetensors",
      "type": "flux2",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "101": {
    "inputs": {
      "vae_name": "Flux\\flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "102": {
    "inputs": {
      "image_base64": avatarB64
    },
    "class_type": "SwarmLoadImageB64",
    "_meta": {
      "title": "SwarmLoadImageB64"
    }
  },
  "103": {
    "inputs": {
      "pixels": [
        "102",
        0
      ],
      "vae": [
        "101",
        0
      ]
    },
    "class_type": "VAEEncode",
    "_meta": {
      "title": "VAE Encode"
    }
  },
  "104": {
    "inputs": {
      "conditioning": [
        "6",
        0
      ],
      "latent": [
        "103",
        0
      ]
    },
    "class_type": "ReferenceLatent",
    "_meta": {
      "title": "ReferenceLatent"
    }
  },
  "105": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "108",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "Save Image"
    }
  },
  "106": {
    "inputs": {
      "upscale_method": "lanczos",
      "megapixels": 1,
      "resolution_steps": 1,
      "image": [
        "102",
        0
      ]
    },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": {
      "title": "ImageScaleToTotalPixels"
    }
  },
  "107": {
    "inputs": {
      "image": [
        "106",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "108": {
    "inputs": {
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SwarmRemBg",
    "_meta": {
      "title": "SwarmRemBg"
    }
  }
    };
}

function buildIllustriousEmotionWorkflow(avatarB64, emotionPrompt, negPrompt, seed, modelName) {
    modelName = modelName || 'illustrious_v10.safetensors';
    return {
        "1": {
            "inputs": { "image": avatarB64, "upload": "image" },
            "class_type": "LoadImageBase64"
        },
        "2": {
            "inputs": { "upscale_method": "lanczos", "width": 768, "height": 768, "crop": "center", "image": ["1", 0] },
            "class_type": "ImageScale"
        },
        "3": {
            "inputs": { "ckpt_name": modelName },
            "class_type": "CheckpointLoaderSimple"
        },
        "4": {
            "inputs": { "text": emotionPrompt + ", masterpiece, best quality, detailed face, solo, simple white background, upper body portrait, looking at viewer", "clip": ["3", 1] },
            "class_type": "CLIPTextEncode"
        },
        "5": {
            "inputs": { "text": negPrompt || "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, blurry, multiple views, multiple people", "clip": ["3", 1] },
            "class_type": "CLIPTextEncode"
        },
        "10": {
            "inputs": { "ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors" },
            "class_type": "IPAdapterModelLoader"
        },
        "11": {
            "inputs": { "clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors" },
            "class_type": "CLIPVisionLoader"
        },
        "12": {
            "inputs": {
                "weight": 0.85, "weight_type": "style transfer",
                "start_at": 0.0, "end_at": 1.0, "unfold_batch": false,
                "model": ["3", 0], "ipadapter": ["10", 0],
                "image": ["2", 0], "clip_vision": ["11", 0]
            },
            "class_type": "IPAdapterApply"
        },
        "20": {
            "inputs": {
                "control_net_name": "control_v11p_sd15_canny.pth",
                "model": ["12", 0]
            },
            "class_type": "ControlNetLoader"
        },
        "21": {
            "inputs": { "low_threshold": 80, "high_threshold": 200, "image": ["2", 0] },
            "class_type": "Canny"
        },
        "22": {
            "inputs": {
                "strength": 0.6,
                "start_percent": 0.0, "end_percent": 0.8,
                "positive": ["4", 0], "negative": ["5", 0],
                "control_net": ["20", 0], "image": ["21", 0]
            },
            "class_type": "ControlNetApplyAdvanced"
        },
        "6": {
            "inputs": { "width": 768, "height": 768, "batch_size": 1 },
            "class_type": "EmptyLatentImage"
        },
        "7": {
            "inputs": {
                "seed": seed, "steps": 25, "cfg": 7,
                "sampler_name": "euler_ancestral", "scheduler": "normal",
                "denoise": 1.0,
                "model": ["12", 0],
                "positive": ["22", 0], "negative": ["22", 1],
                "latent_image": ["6", 0]
            },
            "class_type": "KSampler"
        },
        "8": {
            "inputs": { "samples": ["7", 0], "vae": ["3", 2] },
            "class_type": "VAEDecode"
        },
        "30": {
            "inputs": { "images": ["8", 0] },
            "class_type": "SwarmRemBg"
        },
        "9": {
            "inputs": { "filename_prefix": "cc_emotion_temp", "images": ["30", 0] },
            "class_type": "SaveImage"
        }
    };
}

function buildSD15EmotionWorkflow(avatarB64, emotionPrompt, negPrompt, seed, modelName) {
    modelName = modelName || 'v1-5-pruned-emaonly.safetensors';
    return {
        "1": {
            "inputs": { "image": avatarB64, "upload": "image" },
            "class_type": "LoadImageBase64"
        },
        "2": {
            "inputs": { "upscale_method": "lanczos", "width": 512, "height": 512, "crop": "center", "image": ["1", 0] },
            "class_type": "ImageScale"
        },
        "3": {
            "inputs": { "ckpt_name": modelName },
            "class_type": "CheckpointLoaderSimple"
        },
        "4": {
            "inputs": { "text": emotionPrompt + ", masterpiece, best quality, detailed face, solo, simple white background, upper body portrait, looking at viewer", "clip": ["3", 1] },
            "class_type": "CLIPTextEncode"
        },
        "5": {
            "inputs": { "text": negPrompt || "lowres, bad anatomy, bad hands, text, error, missing fingers, worst quality, low quality, blurry, multiple people", "clip": ["3", 1] },
            "class_type": "CLIPTextEncode"
        },
        "10": {
            "inputs": { "ipadapter_file": "ip-adapter-plus_sd15.safetensors" },
            "class_type": "IPAdapterModelLoader"
        },
        "11": {
            "inputs": { "clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors" },
            "class_type": "CLIPVisionLoader"
        },
        "12": {
            "inputs": {
                "weight": 0.85, "weight_type": "style transfer",
                "start_at": 0.0, "end_at": 1.0, "unfold_batch": false,
                "model": ["3", 0], "ipadapter": ["10", 0],
                "image": ["2", 0], "clip_vision": ["11", 0]
            },
            "class_type": "IPAdapterApply"
        },
        "20": {
            "inputs": { "control_net_name": "control_v11p_sd15_canny.pth" },
            "class_type": "ControlNetLoader"
        },
        "21": {
            "inputs": { "low_threshold": 80, "high_threshold": 200, "image": ["2", 0] },
            "class_type": "Canny"
        },
        "22": {
            "inputs": {
                "strength": 0.6,
                "start_percent": 0.0, "end_percent": 0.8,
                "positive": ["4", 0], "negative": ["5", 0],
                "control_net": ["20", 0], "image": ["21", 0]
            },
            "class_type": "ControlNetApplyAdvanced"
        },
        "6": {
            "inputs": { "width": 512, "height": 512, "batch_size": 1 },
            "class_type": "EmptyLatentImage"
        },
        "7": {
            "inputs": {
                "seed": seed, "steps": 25, "cfg": 7,
                "sampler_name": "euler_ancestral", "scheduler": "normal",
                "denoise": 1.0,
                "model": ["12", 0],
                "positive": ["22", 0], "negative": ["22", 1],
                "latent_image": ["6", 0]
            },
            "class_type": "KSampler"
        },
        "8": {
            "inputs": { "samples": ["7", 0], "vae": ["3", 2] },
            "class_type": "VAEDecode"
        },
        "30": {
            "inputs": { "images": ["8", 0] },
            "class_type": "SwarmRemBg"
        },
        "9": {
            "inputs": { "filename_prefix": "cc_emotion_temp", "images": ["30", 0] },
            "class_type": "SaveImage"
        }
    };
}

function buildSDXLEmotionWorkflow(avatarB64, emotionPrompt, negPrompt, seed, modelName) {
    modelName = modelName || 'sd_xl_base_1.0.safetensors';
    return {
        "1": {
            "inputs": { "image": avatarB64, "upload": "image" },
            "class_type": "LoadImageBase64"
        },
        "2": {
            "inputs": { "upscale_method": "lanczos", "width": 1024, "height": 1024, "crop": "center", "image": ["1", 0] },
            "class_type": "ImageScale"
        },
        "3": {
            "inputs": { "ckpt_name": modelName },
            "class_type": "CheckpointLoaderSimple"
        },
        "4": {
            "inputs": { "text": emotionPrompt + ", masterpiece, best quality, detailed face, solo, simple white background, upper body portrait, looking at viewer", "clip": ["3", 1] },
            "class_type": "CLIPTextEncode"
        },
        "5": {
            "inputs": { "text": negPrompt || "lowres, bad anatomy, bad hands, text, error, worst quality, low quality, blurry, multiple people", "clip": ["3", 1] },
            "class_type": "CLIPTextEncode"
        },
        "10": {
            "inputs": { "ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors" },
            "class_type": "IPAdapterModelLoader"
        },
        "11": {
            "inputs": { "clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors" },
            "class_type": "CLIPVisionLoader"
        },
        "12": {
            "inputs": {
                "weight": 0.85, "weight_type": "style transfer",
                "start_at": 0.0, "end_at": 1.0, "unfold_batch": false,
                "model": ["3", 0], "ipadapter": ["10", 0],
                "image": ["2", 0], "clip_vision": ["11", 0]
            },
            "class_type": "IPAdapterApply"
        },
        "20": {
            "inputs": { "control_net_name": "diffusers_xl_canny_mid.safetensors" },
            "class_type": "ControlNetLoader"
        },
        "21": {
            "inputs": { "low_threshold": 80, "high_threshold": 200, "image": ["2", 0] },
            "class_type": "Canny"
        },
        "22": {
            "inputs": {
                "strength": 0.55,
                "start_percent": 0.0, "end_percent": 0.8,
                "positive": ["4", 0], "negative": ["5", 0],
                "control_net": ["20", 0], "image": ["21", 0]
            },
            "class_type": "ControlNetApplyAdvanced"
        },
        "6": {
            "inputs": { "width": 1024, "height": 1024, "batch_size": 1 },
            "class_type": "EmptyLatentImage"
        },
        "7": {
            "inputs": {
                "seed": seed, "steps": 25, "cfg": 7,
                "sampler_name": "euler_ancestral", "scheduler": "normal",
                "denoise": 1.0,
                "model": ["12", 0],
                "positive": ["22", 0], "negative": ["22", 1],
                "latent_image": ["6", 0]
            },
            "class_type": "KSampler"
        },
        "8": {
            "inputs": { "samples": ["7", 0], "vae": ["3", 2] },
            "class_type": "VAEDecode"
        },
        "30": {
            "inputs": { "images": ["8", 0] },
            "class_type": "SwarmRemBg"
        },
        "9": {
            "inputs": { "filename_prefix": "cc_emotion_temp", "images": ["30", 0] },
            "class_type": "SaveImage"
        }
    };
}
/* ══════════════════════════════════════
   VOICE GENERATION — Workflow & Logic (v2.2)
   ══════════════════════════════════════ */

function buildQwenTTSWorkflow(voiceDesc, textToSpeak, instruct, preset) {
    // Construct the workflow based on the provided JSON structure
    return {
        "26": {
            "inputs": { "text": instruct },
            "class_type": "Text Multiline",
            "_meta": { "title": "Text Multiline" }
        },
        "28": {
            "inputs": {
                "voice_description": voiceDesc,
                "reference_text": textToSpeak,
                "language": "Auto",
                "character_name": (ccData.name || "Character").replace(/[\\/:*?"<>|]/g, '').trim() || "Character",
                "overwrite_character": false,
                "TTS_engine": ["29", 0]
            },
            "class_type": "Qwen3TTSVoiceDesignerNode",
            "_meta": { "title": "🎨 Qwen3-TTS Voice Designer" }
        },
        "29": {
            "inputs": {
                "model_size": "1.7B",
                "device": "auto",
                "voice_preset": preset, // Randomized
                "language": "Auto",
                "instruct": ["26", 0],
                "top_k": 50,
                "top_p": 1,
                "temperature": 0.9,
                "repetition_penalty": 1.05,
                "max_new_tokens": 2048,
                "dtype": "auto",
                "attn_implementation": "sdpa",
                "x_vector_only_mode": false,
                "use_torch_compile": false,
                "use_cuda_graphs": false,
                "compile_mode": "default",
                "asr_use_forced_aligner": true,
                "asr_translate_target_language": "English",
                "asr_translate_instruction_override": "Translate the speech from {source_language} into {target_language} text. Return only the translated text."
            },
            "class_type": "Qwen3TTSEngineNode",
            "_meta": { "title": "⚙️ Qwen3-TTS Engine" }
        },
        "16": {
            "inputs": {
                "filename_prefix": "cc_voice",
                "format": "wav",
                "sample_rate": 24000,
                "normalize": "True",
                "audio": ["28", 1]
            },
            "class_type": "MediaUtilities_SaveAudio",
            "_meta": { "title": "MediaUtilities_SaveAudio" }
        }
    };
}

// CRITICAL: This function is separate from comfyGenerate to avoid conflicts
async function comfyGenerateAudio(wfObj) {
    var base = getComfyUrl();
    var qr = await fetch(base + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wfObj }) });
    if (!qr.ok) { var ei = ''; try { var ed = await qr.json(); ei = ed.error ? ed.error.message : JSON.stringify(ed).substring(0, 200); } catch (e) {} throw new Error('ComfyUI Audio: ' + qr.status + ' ' + ei); }
    var pid = (await qr.json()).prompt_id;
    var dl = Date.now() + 180000;

    while (Date.now() < dl) {
        await new Promise(function (r) { setTimeout(r, 2000); });
        var hr; try { hr = await fetch(base + '/history/' + pid); if (!hr.ok) continue; } catch (e) { continue; }
        var hist = await hr.json(); if (!hist[pid]) continue;

        var entry = hist[pid];
        if (entry.status && entry.status.status_str === 'error') {
            var errMsg = 'ComfyUI error';
            if (entry.status.messages) entry.status.messages.forEach(function (m) { if (m[0] === 'execution_error') errMsg = (m[1].node_type || '') + ': ' + (m[1].exception_message || '').substring(0, 200); });
            throw new Error(errMsg);
        }

        var outs = entry.outputs; if (!outs || !Object.keys(outs).length) { if (entry.status && entry.status.completed) return null; continue; }

        for (var nid in outs) {
            // Look for AUDIO outputs
            var audios = outs[nid] && outs[nid].audio;
            if (audios && audios.length) {
                var a = audios[0];
                var ar = await fetch(base + '/view?' + new URLSearchParams({ filename: a.filename, subfolder: a.subfolder || '', type: a.type || 'output' }).toString());
                if (!ar.ok) continue;
                var blob = await ar.blob();
                var reader = new FileReader();
                return await new Promise(function (res) { reader.onloadend = function () { res(reader.result.split(',')[1]); }; reader.readAsDataURL(blob); });
            }
        }
    }
    throw new Error('ComfyUI Audio timeout (3 min)');
}

async function doGenerateVoice() {
    if (!genQuiet) throw new Error(T('noLLM'));
    if (!ccData.name) throw new Error(T('nameRequired'));

    showStatus(T('generatingVoice'), 'info');

    // 1. Generate Prompts via LLM
    var context = gatherContext();
    var duration = ccData.voiceDuration || 10;
    // ~2.5 words/second for natural TTS speech
    var wordCount = Math.round(duration * 2.5);
    var prompt = PROMPTS.generateVoicePrompts
        .replace(/\{\{CONTEXT\}\}/g, context)
        .replace(/\{\{DURATION\}\}/g, duration)
        .replace(/\{\{WORD_COUNT\}\}/g, wordCount);
    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);

    if (!data) { data = {}; L('Voice prompt parse failed, using defaults.'); }

    var voiceDesc = data.voice_description || ccData.voiceTimbre || 'A pleasant voice.';
    var textToSpeak = data.speak_text || ('Hello, my name is ' + ccData.name + '. Nice to meet you.');
    var styleInstruct = data.style_instructions || 'Natural and clear speech.';

    var preset = TTS_PRESETS[Math.floor(Math.random() * TTS_PRESETS.length)];
    var wf = buildQwenTTSWorkflow(voiceDesc, textToSpeak, styleInstruct, preset);

    try {
        // Get the raw base64 from ComfyUI (likely 32-bit float)
        var rawB64 = await comfyGenerateAudio(wf);

        // Convert to 16-bit PCM WAV
        showStatus('Converting audio format...', 'info');
        var pcmB64 = await convertTo16BitPCM(rawB64);

        ccData.generatedVoiceBase64 = pcmB64;
        renderBody();
        showStatus(T('voiceReady'), 'success');
        return pcmB64;
    } catch (e) {
        showStatus(e.message, 'error');
        throw e;
    }
}

// Audio format conversion helper
async function convertTo16BitPCM(floatBase64) {
    const binaryString = atob(floatBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

    // XTTS works best with 24000Hz mono
    const targetSampleRate = 24000;
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    // Build the WAV file (16-bit PCM)
    const wavBuffer = new ArrayBuffer(44 + channelData.length * 2);
    const view = new DataView(wavBuffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + channelData.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, targetSampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, targetSampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, channelData.length * 2, true);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < channelData.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    // Efficient ArrayBuffer -> base64 conversion
    return btoa(new Uint8Array(wavBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
}

function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
/* Build emotion workflow based on selected model */
function buildEmotionWorkflow(avatarB64, emotionPrompt, seed) {
    var modelType = (ccSettings && ccSettings.emotionsModel) || 'flux2klein';
    var modelName = (ccSettings && ccSettings.emotionsModelName) || '';
    var negPrompt = (ccSettings && ccSettings.emotionsNegPrompt) || '';

    switch (modelType) {
        case 'flux2klein':
            return buildFluxEmotionWorkflow(avatarB64, emotionPrompt, seed);
        case 'illustrious':
        case 'noobai':
            return buildIllustriousEmotionWorkflow(avatarB64, emotionPrompt, negPrompt, seed, modelName);
        case 'sd15':
            return buildSD15EmotionWorkflow(avatarB64, emotionPrompt, negPrompt, seed, modelName);
        case 'sdxl':
            return buildSDXLEmotionWorkflow(avatarB64, emotionPrompt, negPrompt, seed, modelName);
        default:
            return buildFluxEmotionWorkflow(avatarB64, emotionPrompt, seed);
    }
}

/* ══════════════════════════════════════
   genQuiet WRAPPER
   ══════════════════════════════════════ */

async function ccGenQuiet(prompt) {
    window._ccOwnGeneration = true;
    try {
        var result = await genQuiet(prompt);
        return result;
    } finally {
        setTimeout(function () { window._ccOwnGeneration = false; }, 500);
    }
}

/* ══════════════════════════════════════
   PROMPTS
   ══════════════════════════════════════ */

var PROMPTS = {
        simpleGenerate:
        '[OOC: You are a character card creation assistant. The user provides a brief character idea. ' +
        'Create a COMPLETE and DETAILED character card based on this idea.\n\n' +
        'USER IDEA:\n{{IDEA}}\n\n' +
        '{{TEMPLATE_BLOCK}}' +
        '{{REF_IMAGE_BLOCK}}' +
        'Generate a detailed character card in JSON:\n' +
        '{\n' +
        '  "name": "Character Name",\n' +
        '  "description": "Detailed description including appearance, personality, background, motivations, speech patterns. 3-6 paragraphs.",\n' +
        '  "personality": "Brief personality summary: key traits, demeanor, quirks.",\n' +
        '  "scenario": "Brief scenario/context for this character.",\n' +
        '  "first_mes": "In-character greeting/opening action. 2-4 sentences.",\n' +
        '  "mes_example": "<START>\\n{{char}}: *Example of how they speak and act*",\n' +
        '  "race": "", "gender": "", "age": "", "height": "", "weight": "",\n' +
        '  "musculature": "", "hair_color": "", "hairstyle": "", "eye_color": "",\n' +
        '  "bust_size": "", "alignment": "", "temperament": "",\n' +
        '  "intelligence": "", "memory": "", "attention": "", "logic": "",\n' +
        '  "voice_timbre": "", "mental_health": "", "diseases": "",\n' +
        '  "weapon": "", "abilities": "", "languages": "", "relationship": "",\n' +
        '  "buttocks_size": "", "leg_length": "",\n' +
        '  "penis_length_erect": "", "penis_length_flaccid": "",\n' +
        '  "penis_girth_erect": "", "penis_girth_flaccid": "",\n' +
        '  "scrotum_size": "", "ejaculation_volume": ""\n' +
        '}\n\n' +
        'Write in the SAME LANGUAGE as the user\'s idea. Be creative and detailed.\n' +
        'For select fields use EXACTLY one of these values:\n' +
        '- gender: Male, Female, Non-binary, Genderless, Other\n' +
        '- musculature: Skinny, Slim, Average, Athletic, Muscular, Bodybuilder, Chubby, Overweight, Obese\n' +
        '- bust_size: N/A, Flat, Small, Medium, Large, Very Large\n' +
        '- alignment: Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil\n' +
        '- temperament: Choleric, Sanguine, Melancholic, Phlegmatic\n' +
        '- intelligence: Very Low, Low, Below Average, Average, Above Average, High, Very High, Genius\n' +
        '- memory: Poor, Below Average, Average, Good, Excellent, Photographic\n' +
        '- attention: Poor, Below Average, Average, Good, Excellent, Hyperfocused\n' +
        '- logic: Poor, Below Average, Average, Good, Excellent, Exceptional\n' +
        '- voice_timbre: High-pitched, Soft, Average, Deep, Very Deep, Raspy, Melodic, Whispery, Booming, Monotone\n' +
        '- relationship: Stranger, Friend, Best Friend, Lover, Spouse, Sibling, Parent, Child, Mentor, Student, Rival, Enemy, Servant, Master, Pet, Companion, Colleague, Other\n' +
        '- buttocks_size: Flat, Small, Average, Round, Large, Very Large\n' +
        '- leg_length: Short, Below Average, Average, Long, Very Long\n' +
        '- scrotum_size: Small, Average, Large, Very Large, Enormous\n' +
        'ONLY valid JSON!]',

    advancedGenerate:
        '[OOC: You are a character card creation assistant. Generate a COMPLETE character description ' +
        'based on the following detailed attributes.\n\n' +
        'CHARACTER ATTRIBUTES:\n{{ATTRIBUTES}}\n\n' +
        '{{CLOTHING_BLOCK}}' +
        '{{TEMPLATE_BLOCK}}' +
        '{{REF_IMAGE_BLOCK}}' +
        'Create a rich, detailed character card description that incorporates ALL provided attributes ' +
        'naturally into prose. Include appearance, personality, background, motivations, and speech patterns.\n\n' +
        'Respond in JSON:\n' +
        '{\n' +
        '  "description": "Full detailed description. 3-6 paragraphs.",\n' +
        '  "personality": "Brief personality summary.",\n' +
        '  "scenario": "Brief scenario/context.",\n' +
        '  "first_mes": "In-character greeting. 2-4 sentences.",\n' +
        '  "mes_example": "<START>\\n{{char}}: *Example message*"\n' +
        '}\n\n' +
        'Write in the SAME LANGUAGE as the attributes. Be creative. ONLY valid JSON!]',

    generateField:
        '[OOC: You are filling in a character attribute. Based on the context below, ' +
        'generate an appropriate value for the field "{{FIELD_NAME}}".\n\n' +
        'KNOWN INFO:\n{{CONTEXT}}\n\n' +
        '{{OPTIONS_HINT}}' +
        'Respond with ONLY the value for "{{FIELD_NAME}}" — a brief phrase or word. ' +
        'No JSON, no explanation, just the value. Write in the same language as the context.]',

    generateAllFields:
        '[OOC: You are a character creation assistant. Based on the idea/context below, ' +
        'fill in ALL character attributes.\n\n' +
        'KNOWN INFO:\n{{CONTEXT}}\n\n' +
        '{{LOCKED_BLOCK}}' +
        '{{REF_IMAGE_BLOCK}}' +
        'Fill in every field. Be creative and consistent. Respond in JSON:\n' +
        '{\n' +
        '  "name": "", "race": "", "gender": "", "age": "", "weight": "", "height": "",\n' +
        '  "musculature": "", "hairColor": "", "hairstyle": "", "eyeColor": "",\n' +
        '  "bustSize": "", "buttocksSize": "", "legLength": "",\n' +
        '  "alignment": "", "temperament": "", "intelligence": "",\n' +
        '  "memory": "", "attention": "", "logic": "", "voiceTimbre": "",\n' +
        '  "mentalHealth": "", "diseases": "", "weapon": "", "abilities": "",\n' +
        '  "languages": "", "relationship": "",\n' +
        '  "penisLengthErect": "", "penisLengthFlaccid": "",\n' +
        '  "penisGirthErect": "", "penisGirthFlaccid": "",\n' +
        '  "scrotumSize": "", "ejaculationVolume": ""\n' +
        '}\n\n' +
        'For select fields use EXACTLY one of these values:\n' +
        '- gender: Male, Female, Non-binary, Genderless, Other\n' +
        '- musculature: Skinny, Slim, Average, Athletic, Muscular, Bodybuilder, Chubby, Overweight, Obese\n' +
        '- bustSize: N/A, Flat, Small, Medium, Large, Very Large\n' +
        '- buttocksSize: Flat, Small, Average, Round, Large, Very Large\n' +
        '- legLength: Short, Below Average, Average, Long, Very Long\n' +
        '- alignment: Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil\n' +
        '- temperament: Choleric, Sanguine, Melancholic, Phlegmatic\n' +
        '- intelligence: Very Low, Low, Below Average, Average, Above Average, High, Very High, Genius\n' +
        '- memory: Poor, Below Average, Average, Good, Excellent, Photographic\n' +
        '- attention: Poor, Below Average, Average, Good, Excellent, Hyperfocused\n' +
        '- logic: Poor, Below Average, Average, Good, Excellent, Exceptional\n' +
        '- voiceTimbre: High-pitched, Soft, Average, Deep, Very Deep, Raspy, Melodic, Whispery, Booming, Monotone\n' +
        '- relationship: Stranger, Friend, Best Friend, Lover, Spouse, Sibling, Parent, Child, Mentor, Student, Rival, Enemy, Servant, Master, Pet, Companion, Colleague, Other\n' +
        '- scrotumSize: Small, Average, Large, Very Large, Enormous\n' +
        'Write in the same language as the context. ONLY valid JSON!]',

    generateAltGreeting:
        '[OOC: Generate an ALTERNATIVE first message (greeting) for this character.\n\n' +
        'CHARACTER:\n{{DESCRIPTION}}\n\n' +
        'EXISTING FIRST MESSAGE:\n{{FIRST_MES}}\n\n' +
        'Create a DIFFERENT greeting that showcases another side of this character. ' +
        'Different scenario, mood, or approach. 2-4 sentences, in-character.\n\n' +
        'Respond with ONLY the greeting text, nothing else. Same language as the description.]',

    describeImage:
        '[OOC: Describe this image in detail for character creation purposes. ' +
        'Focus on: physical appearance (face, body type, hair, eyes, skin), ' +
        'clothing, accessories, expression, posture, any distinguishing features. ' +
        'Be specific and detailed. 2-3 paragraphs.]',

    portraitPrompt:
        '[OOC: Create an image generation prompt for a character.\n\n' +
        'CHARACTER: {{NAME}}\n\n' +
        'ALL CHARACTER DETAILS:\n{{FULL_DETAILS}}\n\n' +
        '{{OUTFIT_BLOCK}}' +
        'IMAGE TYPE: {{IMAGE_TYPE}}\n\n' +
        'Create a prompt for generating this character image.\n' +
        'STYLE: {{FORMAT_HINT}}\n\n' +
        'RULES BY IMAGE TYPE:\n' +
        'For FACE: close-up face portrait, head and neck only, looking at viewer, solo, simple neutral background.\n' +
        'For PORTRAIT: face + upper body, looking at viewer, solo, simple neutral background.\n' +
        'For FULL BODY: full body standing pose, looking at viewer, solo, simple neutral background, feet visible.\n\n' +
        'IMPORTANT RULES:\n' +
        '- Include ALL physical details.\n' +
        '- Include clothing/outfit details.\n' +
        '- Do NOT include: dynamic poses, action scenes, other characters, complex backgrounds.\n\n' +
        'Respond ONLY with JSON:\n{"image_prompt": "the prompt"}\nONLY JSON!]',
	generateVoicePrompts:
        '[OOC: You are a voice director and scriptwriter for a TTS engine. Generate parameters for a character voice.\n\n' +
        'CHARACTER CONTEXT:\n{{CONTEXT}}\n\n' +
        'TARGET AUDIO DURATION: {{DURATION}} seconds (approx {{WORD_COUNT}} words)\n\n' +
        'TASK:\n' +
        '1. "voice_description": A concise physical description of the voice (pitch, texture, speed) based on the character gender and traits. E.g. "Soft, high-pitched female voice with a gentle tone."\n' +
        '2. "speak_text": A monologue this character would say — a self-introduction, reflection, or short speech that fits the target duration of {{DURATION}} seconds. Write EXACTLY ~{{WORD_COUNT}} words. Make it natural, immersive, and in-character. Use punctuation to control pacing (commas, ellipses for pauses).\n' +
        '3. "style_instructions": Brief style instructions for the TTS engine, e.g. "Speak slowly and clearly with a hint of excitement."\n\n' +
        'Respond ONLY with JSON:\n' +
        '{\n' +
        '  "voice_description": "",\n' +
        '  "speak_text": "",\n' +
        '  "style_instructions": ""\n' +
        '}\n' +
        'Write speak_text in the same language as the character context. ONLY valid JSON!]',
		// Voice prompt template
    enhanceField:
        '[OOC: You are a creative writing assistant. Your task is to rewrite and expand the character description field "{{FIELD_NAME}}".\n\n' +
        'CHARACTER CONTEXT:\n{{CONTEXT}}\n\n' +
        'CURRENT TEXT:\n{{CURRENT_TEXT}}\n\n' +
        'TASK:\n' +
        '1. Rewrite the text to be significantly longer, more detailed, and artistic.\n' +
        '2. Add sensory details, nuanced descriptions, and deeper insights based on the CHARACTER CONTEXT.\n' +
        '3. Ensure the new text does not contradict the context or previously established facts.\n' +
        '4. Focus on "showing" rather than "telling".\n\n' +
        'Respond with ONLY the improved text. No JSON, no headers, no explanations. Write in the same language as the context.]'
};

/* ══════════════════════════════════════
   UI LABELS
   ══════════════════════════════════════ */

var UI = {
    title: 'Character Creator', simple: 'Simple', advanced: 'Advanced',
    basic: 'Basic', appearance: 'Appearance', mind: 'Mind', clothing: 'Clothing',
    abilities: 'Abilities', card: 'Card',
    generate: 'Generate', image: 'Image', template: 'Template', create: 'Create',
    face: 'Face', portrait: 'Portrait', fullbody: 'Full Body',
    genAllFields: 'Generate All Fields', identity: 'Identity',
    refImage: 'Reference Image', charImage: 'Character Image',
    genCard: 'Generated Card', altGreetings: 'Alternative Greetings',
    genAltGreeting: 'Generate Alt Greeting', outfits: 'Outfits',
    addOutfit: 'Add Outfit', currentOutfit: 'Current Outfit (for image)',
    combatSkills: 'Combat & Skills', charCard: 'Character Card',
    messages: 'Messages', templateLoaded: 'Template Loaded',
    clearTemplate: 'Clear Template',
    body: 'Body', hairEyes: 'Hair & Eyes', psychology: 'Psychology',
    cognitive: 'Cognitive', voiceHealth: 'Voice & Health',
    name: 'Name', race: 'Race', gender: 'Gender', age: 'Age',
    relationship: 'Relationship to User', height: 'Height', weight: 'Weight',
    musculature: 'Musculature', bustSize: 'Bust Size', hairColor: 'Hair Color',
    hairstyle: 'Hairstyle', eyeColor: 'Eye Color', alignment: 'Alignment',
    temperament: 'Temperament', intelligence: 'Intelligence', memory: 'Memory',
    attention: 'Attention', logic: 'Logic', voiceTimbre: 'Voice Timbre',
    mentalHealth: 'Mental Health', diseases: 'Diseases / Conditions',
    weapon: 'Personal Weapon', abilitiesLabel: 'Unique Abilities / Spells',
    languages: 'Known Languages',
    buttocksSize: 'Buttocks Size', legLength: 'Leg Length',
    nsfwParams: 'NSFW Parameters',
    penisLengthErect: 'Penis Length (erect)', penisLengthFlaccid: 'Penis Length (flaccid)',
    penisGirthErect: 'Penis Girth (erect)', penisGirthFlaccid: 'Penis Girth (flaccid)',
    scrotumSize: 'Scrotum Size', ejaculationVolume: 'Max Ejaculation Volume',
    description: 'Description', personalityLabel: 'Personality',
    scenario: 'Scenario', firstMessage: 'First Message',
    mesExample: 'Message Examples',
    uploadRef: 'Click to upload a reference image',
    describeImg: 'Describe Image', removeRef: 'Remove',
    resetConfirm: 'Reset all character fields?',
    nameRequired: 'Character name is required!',
    descRequired: 'Generate a description first!',
    noLLM: 'LLM generation not available.',
    ideaEmpty: 'Please enter a character idea first.',
    noPreset: 'No AutoIllustrator preset configured.',
    enterInfoFirst: 'Enter character info first.',
    generating: 'Generating...', creatingChar: 'Creating...',
    generatingImage: 'Generating image...',
    charCreated: ' has been created!',
    fieldsReset: 'Fields reset.',
    templateLoadedMsg: 'Template loaded: ',
    allFieldsGenerated: 'All fields generated!',
    altGreetingGenerated: 'Alt greeting generated!',
    imgDescribed: 'Image described!',
    imgGenerated: 'Image generated!',
    charGenSuccess: 'Character generated successfully!',
    emotionsGen: 'Generate Emotions',
    emotionsGenerating: 'Generating emotion sprites...',
    emotionsDone: 'Emotion sprites generated!',
    emotionsCancelled: 'Emotion generation cancelled.',
    emotionsNoAvatar: 'Avatar image required for emotions generation.',
    emotionsProgress: 'Generating emotion: ',
    // Emotions review UI strings
    emotionsReviewTitle: 'Review Emotion Sprites',
    emotionsRegenerate: 'Regenerate',
    emotionsConfirm: 'Confirm & Upload',
    emotionsReviewHint: 'Click the regenerate button to fix specific emotions. Then click Confirm.',
    emotionsUploading: 'Uploading sprites...',
    // v2.2 Voice UI
    createVoice: 'Create Voice',
    generatingVoice: 'Generating voice...',
    voiceReady: 'Voice ready!',
    downloadVoice: 'Download Audio',
    playVoice: 'Play Sample'
};

function T(key) {
    if (ccData._translated && ccData._trL && ccData._trL[key]) return ccData._trL[key];
    return UI[key] || key;
}

/* ══════════════════════════════════════
   DEFAULTS
   ══════════════════════════════════════ */

var CC_DEFAULTS = {
    enabled: true,
    showButton: true,
    panelPosition: 'right',
    generateAvatar: false,
    avatarPresetId: '',
    showFace: true,
    showPortrait: true,
    showFullbody: true,
    showNSFW: false,
    emotionsModel: 'flux2klein',
    emotionsModelName: '',
    emotionsNegPrompt: '',
    emotionsRemBgNode: 'SwarmRemBg'
};

/* ══════════════════════════════════════
   BOOTSTRAP
   ══════════════════════════════════════ */

jQuery(function () { initCC(); });

async function initCC() {
    try {
        await loadModules();
        await initTranslation();
        loadSettings();
        buildPanel();
        buildSettingsPanel();
        buildChatButton();
        L('Ready! quiet:', !!genQuiet, 'translate:', !!translateFn);
    } catch (e) { E('Init:', e); }
}

async function loadModules() {
    try {
        var m = await import('../../../extensions.js');
        extSettings = m.extension_settings;
        saveFn = m.saveSettingsDebounced;
    } catch (e) { E('ext.js:', e.message); }
    try {
        scriptModule = await import('../../../../script.js');
        if (typeof scriptModule.generateQuietPrompt === 'function') genQuiet = scriptModule.generateQuietPrompt;
    } catch (e) { E('script.js:', e.message); }
}

function loadSettings() {
    if (extSettings) {
        if (!extSettings[CC_MODULE]) extSettings[CC_MODULE] = {};
        var k = Object.keys(CC_DEFAULTS);
        for (var i = 0; i < k.length; i++) {
            if (extSettings[CC_MODULE][k[i]] === undefined) extSettings[CC_MODULE][k[i]] = CC_DEFAULTS[k[i]];
        }
        ccSettings = extSettings[CC_MODULE];
    } else {
        ccSettings = Object.assign({}, CC_DEFAULTS);
    }
}

function saveSett() { if (saveFn) saveFn(); }

/* ══════════════════════════════════════
   TRANSLATION
   ══════════════════════════════════════ */

async function initTranslation() {
    try {
        var t = await import('../../translate/index.js');
        if (typeof t.translate === 'function') { translateFn = t.translate; L('Translate OK'); return; }
    } catch (e) {}
    var h = await getHeaders();
    var b = JSON.stringify({ text: 'test', lang: 'en' });
    var eps = ['/api/translate', '/api/translate/', '/api/translate/translate',
        '/api/plugins/translate', '/api/plugins/translate/', '/api/plugins/translate/translate'];
    for (var i = 0; i < eps.length; i++) {
        try {
            var r = await fetch(eps[i], { method: 'POST', headers: h, body: b });
            if (r.ok) {
                var u = eps[i];
                translateFn = function (t2, l) {
                    return getHeaders().then(function (h2) {
                        return fetch(u, { method: 'POST', headers: h2, body: JSON.stringify({ text: t2, lang: l }) });
                    }).then(function (r2) {
                        if (!r2.ok) throw new Error('HTTP ' + r2.status);
                        return r2.text();
                    }).then(function (txt) {
                        try { var j = JSON.parse(txt); return typeof j === 'string' ? j : (j.text || txt); } catch (e) { return txt; }
                    });
                };
                L('Translate API:', u); return;
            }
        } catch (e) {}
    }
}

function getLang() {
    return (extSettings && extSettings.translate && extSettings.translate.target_language) || 'en';
}
async function tr(t) { if (!translateFn || !t || !t.trim()) return t; return await translateFn(t, getLang()); }

async function translateUI() {
    if (!translateFn) throw new Error('Translation unavailable.');
    if (ccData._translated) return;
    ccData._trL = {};
    var keys = Object.keys(UI);
    for (var i = 0; i < keys.length; i++) {
        ccData._trL[keys[i]] = await tr(UI[keys[i]]);
    }
    ccData._translated = true;
}

function untranslateUI() {
    ccData._translated = false;
    ccData._trL = {};
}

/* ══════════════════════════════════════
   HELPERS
   ══════════════════════════════════════ */

function parseJSON(t) {
    try { return JSON.parse(t); } catch (e) {}
    var m = t.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch (e) {}
    return null;
}

function escJ(s) {
    if (!s) return '';
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        .replace(/\n/g, '\\n').replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t').replace(/[\x00-\x1f]/g, '');
}

async function getHeaders() {
    if (scriptModule && typeof scriptModule.getRequestHeaders === 'function')
        try { return scriptModule.getRequestHeaders(); } catch (e) {}
    var h = { 'Content-Type': 'application/json' };
    try { var r = await fetch('/csrf-token'); if (r.ok) { var d = await r.json(); if (d.token) h['X-CSRF-Token'] = d.token; } } catch (e) {}
    return h;
}

function b64ToBlob(b64, type) {
    type = type || 'image/png';
    var raw = atob(b64); var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: type });
}

function isLocked(key) { return !!(ccData.locked && ccData.locked[key]); }
function toggleLock(key) {
    if (!ccData.locked) ccData.locked = {};
    ccData.locked[key] = !ccData.locked[key];
}

function isSectionLocked(sectionId) { return !!(ccData.lockedSections && ccData.lockedSections[sectionId]); }

// Map fields to sections for locking logic
var SECTION_MAP = {
    'name': 'identity', 'race': 'identity', 'gender': 'identity', 'age': 'identity', 'relationship': 'identity',
    'height': 'body', 'weight': 'body', 'musculature': 'body', 'bustSize': 'body', 'buttocksSize': 'body', 'legLength': 'body',
    'penisLengthErect': 'nsfw', 'penisLengthFlaccid': 'nsfw', 'penisGirthErect': 'nsfw', 'penisGirthFlaccid': 'nsfw', 'scrotumSize': 'nsfw', 'ejaculationVolume': 'nsfw',
    'hairColor': 'hairEyes', 'hairstyle': 'hairEyes', 'eyeColor': 'hairEyes',
    'alignment': 'psychology', 'temperament': 'psychology',
    'intelligence': 'cognitive', 'memory': 'cognitive', 'attention': 'cognitive', 'logic': 'cognitive',
    'voiceTimbre': 'voiceHealth', 'mentalHealth': 'voiceHealth', 'diseases': 'voiceHealth'
};

function toggleSectionLock(sectionId) {
    if (!ccData.lockedSections) ccData.lockedSections = {};
    ccData.lockedSections[sectionId] = !ccData.lockedSections[sectionId];
}

async function doGenerateSection(sectionId) {
    if (!genQuiet) throw new Error(T('noLLM'));

    // Map section ID to fields
    var sectionFields = {
        'identity': ['name', 'race', 'gender', 'age', 'relationship'],
        'body': ['height', 'weight', 'musculature', 'bustSize', 'buttocksSize', 'legLength'],
        'nsfw': ['penisLengthErect', 'penisLengthFlaccid', 'penisGirthErect', 'penisGirthFlaccid', 'scrotumSize', 'ejaculationVolume'],
        'hairEyes': ['hairColor', 'hairstyle', 'eyeColor'],
        'psychology': ['alignment', 'temperament'],
        'cognitive': ['intelligence', 'memory', 'attention', 'logic'],
        'voiceHealth': ['voiceTimbre', 'mentalHealth', 'diseases']
    };

    var fields = sectionFields[sectionId];
    if (!fields) return;

    // Filter out locked fields
    var toGen = fields.filter(function(f) { return !isLocked(f); });
    if (!toGen.length) {
        showStatus('All fields in section are locked!', 'error');
        return;
    }

    var context = gatherContext();
    var contextIsEmpty = !ccData.simpleIdea && !ccData.name && !ccData.race && !ccData.gender;

    var randomBlock = contextIsEmpty
        ? '\nCRITICAL: No character information is provided above. You must generate a COMPLETELY RANDOM and FICTIONAL character. DO NOT use information about the user.\n\n'
        : '\nUse the provided character info.\n\n';

    var selectValidation = {
        gender: ['Male', 'Female', 'Non-binary', 'Genderless', 'Other'],
        musculature: ['Skinny', 'Slim', 'Average', 'Athletic', 'Muscular', 'Bodybuilder', 'Chubby', 'Overweight', 'Obese'],
        bustSize: ['N/A', 'Flat', 'Small', 'Medium', 'Large', 'Very Large'],
        buttocksSize: ['Flat', 'Small', 'Average', 'Round', 'Large', 'Very Large'],
        legLength: ['Short', 'Below Average', 'Average', 'Long', 'Very Long'],
        alignment: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
        temperament: ['Choleric', 'Sanguine', 'Melancholic', 'Phlegmatic'],
        intelligence: ['Very Low', 'Low', 'Below Average', 'Average', 'Above Average', 'High', 'Very High', 'Genius'],
        memory: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Photographic'],
        attention: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Hyperfocused'],
        logic: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Exceptional'],
        voiceTimbre: ['High-pitched', 'Soft', 'Average', 'Deep', 'Very Deep', 'Raspy', 'Melodic', 'Whispery', 'Booming', 'Monotone'],
        relationship: ['Stranger', 'Friend', 'Best Friend', 'Lover', 'Spouse', 'Sibling', 'Parent', 'Child', 'Mentor', 'Student', 'Rival', 'Enemy', 'Servant', 'Master', 'Pet', 'Companion', 'Colleague', 'Other'],
        scrotumSize: ['Small', 'Average', 'Large', 'Very Large', 'Enormous']
    };

    var fieldDesc = toGen.map(function (fk) {
        var hint = selectValidation[fk] ? ' (choose from: ' + selectValidation[fk].join(', ') + ')' : '';
        return '"' + fk + '"' + hint;
    }).join('\n');

    var prompt = '[OOC: Generate values for these character fields.\n\n' +
        randomBlock +
        'CONTEXT:\n' + (contextIsEmpty ? '(None - be random)' : context) + '\n\n' +
        'FIELDS:\n' + fieldDesc + '\n\n' +
        'Respond ONLY with valid JSON:\n{' +
        toGen.map(function (f) { return '"' + f + '": ""'; }).join(', ') +
        '}\n]';

    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);
    if (!data) throw new Error('Failed to parse LLM response.');

    for (var k in data) {
        if (!data.hasOwnProperty(k)) continue;
        var val = data[k];
        if (!val || val === 'N/A') continue;
        if (isLocked(k)) continue; // Double check lock

        if (selectValidation[k]) val = matchSelectOption(val, selectValidation[k]);
        ccData[k] = val;
    }

    L('Section generated:', sectionId);
}

function setField(key, val) {
    if (isLocked(key)) return;
    ccData[key] = val;
}

function matchSelectOption(val, options) {
    if (!val || !options) return val;
    var lower = val.toLowerCase().trim();
    for (var i = 0; i < options.length; i++) {
        if (options[i].toLowerCase() === lower) return options[i];
    }
    for (var j = 0; j < options.length; j++) {
        if (lower.indexOf(options[j].toLowerCase()) !== -1 || options[j].toLowerCase().indexOf(lower) !== -1) return options[j];
    }
    return val;
}


/* ══════════════════════════════════════
   TEMPLATE (PNG / JSON)
   ══════════════════════════════════════ */

async function extractCharFromFile(file) {
    var name = file.name.toLowerCase();
    if (name.endsWith('.json')) return JSON.parse(await file.text());
    if (name.endsWith('.png')) return await extractCharFromPNG(file);
    throw new Error('Use PNG or JSON files.');
}

async function extractCharFromPNG(file) {
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    var view = new DataView(buf);
    if (bytes[0] !== 137 || bytes[1] !== 80) throw new Error('Not a valid PNG.');
    var offset = 8;
    while (offset < buf.byteLength - 12) {
        var chunkLen = view.getUint32(offset);
        var chunkType = '';
        for (var t = 0; t < 4; t++) chunkType += String.fromCharCode(bytes[offset + 4 + t]);
        if (chunkType === 'tEXt' || chunkType === 'iTXt') {
            var chunkData = bytes.slice(offset + 8, offset + 8 + chunkLen);
            var nullIdx = -1;
            for (var n = 0; n < Math.min(chunkData.length, 20); n++) { if (chunkData[n] === 0) { nullIdx = n; break; } }
            if (nullIdx > 0) {
                var keyword = new TextDecoder().decode(chunkData.slice(0, nullIdx));
                if (keyword === 'chara') {
                    var valueStart = nullIdx + 1;
                    if (chunkType === 'iTXt') { var nulls = 0; for (var p = nullIdx + 1; p < chunkData.length && nulls < 3; p++) { if (chunkData[p] === 0) nulls++; if (nulls >= 3) { valueStart = p + 1; break; } } }
                    return JSON.parse(atob(new TextDecoder().decode(chunkData.slice(valueStart)).trim()));
                }
            }
        }
        offset += 12 + chunkLen;
    }
    throw new Error('No character data in PNG.');
}

function formatCardAsTemplate(card) {
    var parts = []; var d = card.data || card;
    if (d.name || card.name) parts.push('NAME: ' + (d.name || card.name));
    var desc = (d.description || card.description || '').replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n');
    if (desc) parts.push('DESCRIPTION:\n' + desc.substring(0, 3000));
    if (d.personality || card.personality) parts.push('PERSONALITY:\n' + (d.personality || card.personality).substring(0, 1000));
    if (d.scenario || card.scenario) parts.push('SCENARIO:\n' + (d.scenario || card.scenario).substring(0, 800));
    var first = (d.first_mes || card.first_mes || '').replace(/\\r\\n/g, '\n');
    if (first) parts.push('FIRST MESSAGE:\n' + first.substring(0, 2000));
    if (d.mes_example || card.mes_example) parts.push('MESSAGE EXAMPLES:\n' + (d.mes_example || card.mes_example).substring(0, 1000));
    return parts.join('\n\n');
}

/* ══════════════════════════════════════
   AUTOILLUSTRATOR INTEGRATION
   ══════════════════════════════════════ */

var BLANK_PNG_512 = (function () {
    try {
        var c = document.createElement('canvas'); c.width = 512; c.height = 512;
        var x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
        var d = c.toDataURL('image/png'); var ci = d.indexOf(',');
        var b64 = ci >= 0 ? d.substring(ci + 1) : d;
        b64 = b64.replace(/[\s\r\n]/g, '');
        var pad = b64.length % 4;
        if (pad === 2) b64 += '=='; else if (pad === 3) b64 += '=';
        else if (pad === 1) b64 = b64.substring(0, b64.length - 1);
        return b64;
    } catch (e) { return 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12NgGAWDEwAAAZAAASlMlecAAAAASUVORK5CYII='; }
})();

function getAISettings() { return (extSettings && extSettings.auto_illustrator) ? extSettings.auto_illustrator : null; }
function getAIPresetsAll() { var ai = getAISettings(); return (ai && ai.workflowPresets) ? ai.workflowPresets : []; }
function getAIPresetById(id) { if (!id) return null; return getAIPresetsAll().find(function (p) { return p.id === id; }) || null; }
function getAIActivePreset() {
    if (ccSettings && ccSettings.avatarPresetId) { var c = getAIPresetById(ccSettings.avatarPresetId); if (c) return c; }
    var ai = getAISettings(); if (!ai || !ai.workflowPresets || !ai.activePresetId) return null;
    return ai.workflowPresets.find(function (p) { return p.id === ai.activePresetId; }) || null;
}
/* Emotions model selection.
   ccSettings.emotionsModel holds either a built-in key
   ('flux2klein' | 'illustrious' | 'noobai' | 'sdxl' | 'sd15')
   or an AutoIllustrator preset reference in the form 'preset:<presetId>'. */
function getEmotionModelSel() { return (ccSettings && ccSettings.emotionsModel) || 'flux2klein'; }
function isEmotionPresetSel() { return getEmotionModelSel().indexOf('preset:') === 0; }
function getEmotionPreset() {
    var sel = getEmotionModelSel();
    if (sel.indexOf('preset:') !== 0) return null;
    var id = sel.substring('preset:'.length);
    return getAIPresetById(id) || null;
}
function getComfyUrl() {
    var ai = getAISettings(); if (ai && ai.comfyUrl && ai.comfyUrl.trim()) return ai.comfyUrl.trim().replace(/\/+$/, '');
    if (extSettings && extSettings.sd && extSettings.sd.comfy_url) return extSettings.sd.comfy_url.replace(/\/+$/, '');
    return 'http://127.0.0.1:8188';
}
function getFormatHint() {
    var preset = getAIActivePreset(); var fmt = preset ? (preset.promptFormat || 'flux') : 'flux';
    var key = fmt.replace(/^pov_/, '');
    var hints = { flux: 'Vivid natural-language description.', sd15: 'Comma-separated tags.', illustrious: 'Danbooru tags.', noobai: 'Danbooru/gelbooru tags.', custom: 'Descriptive prompt.' };
    return hints[key] || hints.flux;
}

function fillWorkflow(wStr, promptText, negText, width, height, preset, uploadedInputName) {
    var t = wStr; var sd = (extSettings && extSettings.sd) || {};
    function v(pv, k1, def) { return pv || sd[k1] || def || ''; }
    var sm = { '%prompt%': escJ(promptText), '%negative_prompt%': escJ(negText || ''), '%model%': escJ(v(preset && preset.model, 'comfy_model', '')), '%vae%': escJ(v(preset && preset.vae, 'comfy_vae', '')), '%vae_name%': escJ(v(preset && preset.vae, 'comfy_vae', '')), '%sampler%': escJ(v(preset && preset.sampler, 'comfy_sampler', 'euler')), '%scheduler%': escJ(v(preset && preset.scheduler, 'comfy_scheduler', 'normal')), '%clip_name%': escJ(sd.comfy_clip || ''), '%clip_name1%': escJ(sd.comfy_clip1 || sd.comfy_clip || ''), '%clip_name2%': escJ(sd.comfy_clip2 || '') };

    // Get the uploaded reference (or a black square if the box is unchecked)
    var charAv = (ccData.useRefAsCharAvatar && ccData.refImageBase64) ? ccData.refImageBase64 : BLANK_PNG_512;

    sm['%user_avatar%'] = BLANK_PNG_512;
    sm['%char_avatar%'] = charAv;
    sm['%input_image%'] = charAv;
    sm['%input_image_name%'] = uploadedInputName || 'empty.png';

    // IMPORTANT: pass the image into the first slot only (%avatar_1%)
    sm['%avatar_1%'] = charAv;

    // Replace the remaining slots (2..8) with black squares
    // so there are no gaps and no extra load on ReferenceLatent
    for (var ai = 2; ai <= 8; ai++) {
        sm['%avatar_' + ai + '%'] = BLANK_PNG_512;
    }

    var nm = { '%width%': width || 512, '%height%': height || 768, '%seed%': Math.floor(Math.random() * 2147483647), '%steps%': (preset && preset.steps) || sd.comfy_steps || 20, '%cfg%': (preset && preset.cfg) || sd.comfy_cfg || 7, '%scale%': (preset && preset.cfg) || sd.comfy_cfg || 7, '%denoise%': (preset && preset.denoise !== undefined) ? preset.denoise : 1, '%clip_skip%': (preset && preset.clipSkip) || 1, '%batch%': 1, '%batch_size%': 1 };

    var key; for (key in sm) if (sm.hasOwnProperty(key)) t = t.split(key).join(sm[key]);
    for (key in nm) if (nm.hasOwnProperty(key)) { var val = String(nm[key]); t = t.split('"' + key + '"').join(val); t = t.split(key).join(val); }
    try { return JSON.parse(t); } catch (e) { E('Workflow JSON error:', e.message); return null; }
}

/* Fill an AutoIllustrator preset workflow for a single emotion sprite.
   Unlike fillWorkflow, the character avatar is ALWAYS injected into every
   reference-image slot (the avatar IS the source identity here), and the
   emotion text becomes the prompt. The preset is expected to handle
   background removal and identity preservation (Edit model / IP-Adapter). */
function fillEmotionWorkflow(wStr, emotionPrompt, negText, width, height, preset, avatarB64, uploadedName, seed) {
    var t = wStr; var sd = (extSettings && extSettings.sd) || {};
    function v(pv, k1, def) { return pv || sd[k1] || def || ''; }
    var sm = {
        '%prompt%': escJ(emotionPrompt),
        '%negative_prompt%': escJ(negText || ''),
        '%model%': escJ(v(preset && preset.model, 'comfy_model', '')),
        '%vae%': escJ(v(preset && preset.vae, 'comfy_vae', '')),
        '%vae_name%': escJ(v(preset && preset.vae, 'comfy_vae', '')),
        '%sampler%': escJ(v(preset && preset.sampler, 'comfy_sampler', 'euler')),
        '%scheduler%': escJ(v(preset && preset.scheduler, 'comfy_scheduler', 'normal')),
        '%clip_name%': escJ(sd.comfy_clip || ''),
        '%clip_name1%': escJ(sd.comfy_clip1 || sd.comfy_clip || ''),
        '%clip_name2%': escJ(sd.comfy_clip2 || '')
    };

    // The avatar is the reference identity — push it into every image slot.
    sm['%user_avatar%'] = avatarB64;
    sm['%char_avatar%'] = avatarB64;
    sm['%input_image%'] = avatarB64;
    sm['%input_image_name%'] = uploadedName || 'cc_avatar.png';
    for (var ai = 1; ai <= 8; ai++) sm['%avatar_' + ai + '%'] = avatarB64;

    var nm = {
        '%width%': width || 768, '%height%': height || 768,
        '%seed%': (seed !== undefined ? seed : Math.floor(Math.random() * 2147483647)),
        '%steps%': (preset && preset.steps) || sd.comfy_steps || 20,
        '%cfg%': (preset && preset.cfg) || sd.comfy_cfg || 7,
        '%scale%': (preset && preset.cfg) || sd.comfy_cfg || 7,
        '%denoise%': (preset && preset.denoise !== undefined) ? preset.denoise : 1,
        '%clip_skip%': (preset && preset.clipSkip) || 1,
        '%batch%': 1, '%batch_size%': 1
    };

    var key; for (key in sm) if (sm.hasOwnProperty(key)) t = t.split(key).join(sm[key]);
    for (key in nm) if (nm.hasOwnProperty(key)) { var val = String(nm[key]); t = t.split('"' + key + '"').join(val); t = t.split(key).join(val); }
    try { return JSON.parse(t); } catch (e) { E('Emotion workflow JSON error:', e.message); return null; }
}

async function comfyGenerate(wfObj) {
    var base = getComfyUrl();
    var qr = await fetch(base + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wfObj }) });
    if (!qr.ok) { var ei = ''; try { var ed = await qr.json(); ei = ed.error ? ed.error.message : JSON.stringify(ed).substring(0, 200); } catch (e) {} throw new Error('ComfyUI: ' + qr.status + ' ' + ei); }
    var pid = (await qr.json()).prompt_id;
    var dl = Date.now() + 180000;
    while (Date.now() < dl) {
        await new Promise(function (r) { setTimeout(r, 2000); });
        var hr; try { hr = await fetch(base + '/history/' + pid); if (!hr.ok) continue; } catch (e) { continue; }
        var hist = await hr.json(); if (!hist[pid]) continue;
        var entry = hist[pid];
        if (entry.status && entry.status.status_str === 'error') { var errMsg = 'ComfyUI error'; if (entry.status.messages) entry.status.messages.forEach(function (m) { if (m[0] === 'execution_error') errMsg = (m[1].node_type || '') + ': ' + (m[1].exception_message || '').substring(0, 200); }); throw new Error(errMsg); }
        var outs = entry.outputs; if (!outs || !Object.keys(outs).length) { if (entry.status && entry.status.completed) return null; continue; }
        for (var nid in outs) { var imgs = outs[nid] && outs[nid].images; if (!imgs || !imgs.length) continue;
            var ir = await fetch(base + '/view?' + new URLSearchParams({ filename: imgs[0].filename, subfolder: imgs[0].subfolder || '', type: imgs[0].type || 'output' }).toString());
            if (!ir.ok) continue; var blob = await ir.blob(); var reader = new FileReader();
            return await new Promise(function (res) { reader.onloadend = function () { res(reader.result.split(',')[1]); }; reader.readAsDataURL(blob); });
        }
    }
    throw new Error('ComfyUI timeout (3 min)');
}

/* ══════════════════════════════════════
   COMFY — Upload image as base64 input
   (Required for LoadImageBase64 node)
   ══════════════════════════════════════ */

async function comfyUploadImage(b64, filename) {
    var base = getComfyUrl();
    var blob = b64ToBlob(b64, 'image/png');
    var fd = new FormData();
    fd.append('image', blob, filename || 'cc_input.png');
    fd.append('overwrite', 'true');
    var r = await fetch(base + '/upload/image', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('ComfyUI upload failed: ' + r.status);
    var data = await r.json();
    return data.name || filename;
}

/* ══════════════════════════════════════
   EMOTIONS — Core Generation Logic
   ══════════════════════════════════════ */

async function generateSingleEmotion(emotionLabel, avatarB64, uploadedName) {
    var emotionPrompt = EMOTION_PROMPTS[emotionLabel];
    if (!emotionPrompt) return null;

    var seed = Math.floor(Math.random() * 2147483647);

    // If an AutoIllustrator preset is selected, drive ComfyUI through it.
    if (isEmotionPresetSel()) {
        var preset = getEmotionPreset();
        if (!preset || !preset.workflow) throw new Error(T('noPreset'));

        // Safety tags so the preset keeps a single solo subject + clean comp.
        var finalPrompt = emotionPrompt + ', solo, single person, looking at viewer, detailed face, simple background, keeping original character and outfit';
        var baseW = preset.width || 768, baseH = preset.height || 768;
        var neg = preset.negativePrompt || '';

        var wf = fillEmotionWorkflow(preset.workflow, finalPrompt, neg, baseW, baseH, preset, avatarB64, uploadedName, seed);
        if (!wf) throw new Error('Failed to parse emotions workflow.');
        return await comfyGenerate(wf);
    }

    // Otherwise use one of the built-in workflows.
    var workflow = buildEmotionWorkflow(avatarB64, emotionPrompt, seed);
    return await comfyGenerate(workflow);
}



/* ══════════════════════════════════════
   EMOTIONS — Core Generation Logic (Updated)
   ══════════════════════════════════════ */

async function doGenerateEmotions(charName) {
    var avatarB64 = null;
    if (ccData.avatarSource === 'face') avatarB64 = ccData.generatedFaceBase64;
    else if (ccData.avatarSource === 'fullbody') avatarB64 = ccData.generatedFullbodyBase64;
	else if (ccData.avatarSource === 'ref') avatarB64 = ccData.refImageBase64;
    else avatarB64 = ccData.generatedPortraitBase64;
    if (!avatarB64) avatarB64 = ccData.generatedPortraitBase64 || ccData.generatedFaceBase64 || ccData.generatedFullbodyBase64;

    if (!avatarB64) throw new Error(T('emotionsNoAvatar'));

    ccEmotionsCancelled = false;
    var variantCount = ccData.emotionVariantCount || 1;
    var totalEmotions = EMOTION_LABELS.length * variantCount;
    var generated = [];

    showEmotionsOverlay(totalEmotions);

    var uploadedName;
    try {
        uploadedName = await comfyUploadImage(avatarB64, 'cc_avatar_' + charName.replace(/[^a-zA-Z0-9]/g, '_') + '.png');
    } catch (e) {
        hideEmotionsOverlay();
        throw new Error('Failed to upload avatar to ComfyUI: ' + e.message);
    }

    // Loop through emotions
    for (var i = 0; i < EMOTION_LABELS.length; i++) {
        if (ccEmotionsCancelled) {
            hideEmotionsOverlay();
            throw new Error(T('emotionsCancelled'));
        }

        var emotionLabel = EMOTION_LABELS[i];

        // Loop through variants
        for (var v = 0; v < variantCount; v++) {
            if (ccEmotionsCancelled) break;

            var currentIndex = (i * variantCount) + v;
            // Label for logging and UI: joy, joy-1, joy-2 etc.
            // Standard naming: base (index 0) has no suffix, others have -v
            var variantIndex = v; // 0, 1, 2...

            updateEmotionsProgress(currentIndex, totalEmotions, emotionLabel + (variantIndex > 0 ? '-'+variantIndex : ''));

            try {
                var resultB64 = await generateSingleEmotion(emotionLabel, avatarB64, uploadedName);

                if (resultB64) {
                    generated.push({ label: emotionLabel, index: variantIndex, b64: resultB64 });
                    addEmotionPreview(emotionLabel, variantIndex, resultB64);
                } else {
                    generated.push({ label: emotionLabel, index: variantIndex, b64: null, error: 'Empty result' });
                    updateEmotionsError(emotionLabel + '-'+variantIndex, 'Empty result');
                }
            } catch (e) {
                E('Emotion generation failed for', emotionLabel, 'variant', variantIndex, ':', e.message);
                generated.push({ label: emotionLabel, index: variantIndex, b64: null, error: e.message });
                updateEmotionsError(emotionLabel + '-'+variantIndex, e.message);
            }
        }
    }

    hideEmotionsOverlay();
    showEmotionReviewModal(generated, charName, avatarB64, uploadedName);
}

/* ══════════════════════════════════════
   EMOTIONS — Review Modal UI (Updated)
   ══════════════════════════════════════ */

function showEmotionReviewModal(sprites, charName, avatarB64, uploadedName) {
    hideEmotionReviewModal();

    var h = '<div class="cc-review-overlay" id="cc-review-overlay">';
    h += '<div class="cc-review-modal">';
    h += '<div class="cc-review-header"><h3>🎭 ' + esc(T('emotionsReviewTitle')) + '</h3><div class="cc-review-close" id="cc-review-close">×</div></div>';
    h += '<div class="cc-review-hint">' + esc(T('emotionsReviewHint')) + ' Use +/- to manage variants.</div>';
    h += '<div class="cc-review-grid" id="cc-review-grid">';

    // Sort sprites for consistent display
    sprites.sort(function(a, b) {
        if (a.label === b.label) return a.index - b.index;
        return EMOTION_LABELS.indexOf(a.label) - EMOTION_LABELS.indexOf(b.label);
    });

    for (var i = 0; i < sprites.length; i++) {
        var sp = sprites[i];
        h += createReviewItemHTML(sp, i);
    }

    h += '</div>'; // grid end
    h += '<div class="cc-review-footer">';
    h += '<button class="menu_button" id="cc-review-cancel">Cancel</button>';
    h += '<button class="menu_button cc-btn-success" id="cc-review-confirm"><i class="fa-solid fa-check"></i> ' + esc(T('emotionsConfirm')) + '</button>';
    h += '</div>';
    h += '</div></div>';

    $('body').append(h);

    window._ccReviewData = {
        sprites: sprites,
        charName: charName,
        avatarB64: avatarB64,
        uploadedName: uploadedName
    };

    // Event Handlers
    $('#cc-review-close, #cc-review-cancel').on('click', hideEmotionReviewModal);

    $('#cc-review-confirm').on('click', async function() {
        var $btn = $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i> ' + T('emotionsUploading'));
        var data = window._ccReviewData;
        var validSprites = data.sprites.filter(function(s) { return s.b64; });

        try {
            updateEmotionsStatus(T('emotionsUploading'));
            await uploadSpritesToCharacter(data.charName, validSprites);
            hideEmotionReviewModal();
            showStatus(T('emotionsDone'), 'success');
            if (typeof toastr !== 'undefined') toastr.success('Emotions uploaded successfully!', 'Character Creator');
        } catch (e) {
            showStatus('Upload failed: ' + e.message, 'error');
            if (typeof toastr !== 'undefined') toastr.error('Upload failed: ' + e.message);
            $btn.prop('disabled', false).html('<i class="fa-solid fa-check"></i> ' + esc(T('emotionsConfirm')));
        }
    });

    // Delegate clicks for dynamic buttons
        // Delegate clicks for dynamic buttons
    $('#cc-review-grid').on('click', '.cc-review-regen', async function() {
        var $btn = $(this);
        var idx = parseInt($btn.data('idx'));
        // Use window._ccReviewData instead of data
        var sp = window._ccReviewData.sprites[idx];

        $btn.html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try {
            // Use window._ccReviewData
            var newB64 = await generateSingleEmotion(sp.label, window._ccReviewData.avatarB64, window._ccReviewData.uploadedName);
            if (newB64) {
                sp.b64 = newB64;
                sp.error = null;
                updateReviewItem(idx, sp);
            }
        } catch (e) {
            showStatus('Failed to regenerate ' + sp.label, 'error');
            $btn.html('<i class="fa-solid fa-rotate"></i>');
        }
    });

    // Add Variant Button
    $('#cc-review-grid').on('click', '.cc-review-add', async function() {
        var $btn = $(this);
        var label = $btn.data('label');

        $btn.html('<i class="fa-solid fa-circle-notch fa-spin"></i>');

        // Find max index for this label
        var maxIdx = 0;
        window._ccReviewData.sprites.forEach(function(s) {
            if (s.label === label && s.index > maxIdx) maxIdx = s.index;
        });

        var newIndex = maxIdx + 1;

        try {
            var newB64 = await generateSingleEmotion(label, window._ccReviewData.avatarB64, window._ccReviewData.uploadedName);
            if (newB64) {
                var newSprite = { label: label, index: newIndex, b64: newB64 };
                window._ccReviewData.sprites.push(newSprite);

                // Re-render grid or append. Simple append:
                $('#cc-review-grid').append(createReviewItemHTML(newSprite, window._ccReviewData.sprites.length - 1));
                sortReviewGrid(); // Keep it tidy
            }
        } catch (e) {
            showStatus('Failed to add variant', 'error');
        }
        $btn.html('<i class="fa-solid fa-plus"></i>');
    });

    // Delete Variant Button
    $('#cc-review-grid').on('click', '.cc-review-delete', function() {
        var idx = parseInt($(this).data('idx'));
        var sp = window._ccReviewData.sprites[idx];

        if (sp.index === 0) {
            alert("Cannot delete the base emotion (Index 0). Only variants can be removed.");
            return;
        }

        // Remove from array
        window._ccReviewData.sprites.splice(idx, 1);
        // Remove from DOM
        $('.cc-review-item[data-idx="' + idx + '"]').remove();

        // Re-index remaining items to keep data-idx accurate?
        // Easiest is just to re-render the grid entirely to avoid confusion.
        reRenderReviewGrid();
    });
}

function createReviewItemHTML(sp, arrayIndex) {
    var src = sp.b64 ? 'data:image/png;base64,' + sp.b64 : '';
    var errClass = sp.error ? 'cc-review-error' : '';
    var displayName = sp.label + (sp.index > 0 ? '-' + sp.index : '');

    var h = '<div class="cc-review-item ' + errClass + '" data-label="' + esc(sp.label) + '" data-idx="' + arrayIndex + '">';
    if (sp.b64) {
        // Adds data-cc-lightbox and data-idx
        h += '<img src="' + src + '" title="' + esc(displayName) + '" data-cc-lightbox="emotion" data-idx="' + arrayIndex + '">';
    } else {
        h += '<div class="cc-review-noimg">⚠️<br><small>Error</small></div>';
    }
    h += '<div class="cc-review-label">' + esc(displayName) + '</div>';
    h += '<div class="cc-review-controls">';

    h += '<button class="menu_button cc-review-regen" data-idx="' + arrayIndex + '" title="Regenerate"><i class="fa-solid fa-rotate"></i></button>';

    if (sp.index === 0) {
         h += '<button class="menu_button cc-review-add" data-label="' + esc(sp.label) + '" title="Add Variant"><i class="fa-solid fa-plus"></i></button>';
    }

    if (sp.index > 0) {
        h += '<button class="menu_button cc-btn-danger cc-review-delete" data-idx="' + arrayIndex + '" title="Delete Variant"><i class="fa-solid fa-trash"></i></button>';
    }

    h += '</div></div>';
    return h;
}

function updateReviewItem(arrayIndex, sp) {
    var $item = $('.cc-review-item[data-idx="' + arrayIndex + '"]');
    $item.removeClass('cc-review-error');
    var src = 'data:image/png;base64,' + sp.b64;
    $item.find('img').attr('src', src);
    $item.find('.cc-review-regen').html('<i class="fa-solid fa-rotate"></i>');
}

function sortReviewGrid() {
    var $grid = $('#cc-review-grid');
    var items = $grid.find('.cc-review-item').get();
    items.sort(function(a, b) {
        var labelA = $(a).data('label');
        var labelB = $(b).data('label');
        var idxA = parseInt($(a).data('idx')); // This idx is array index, not variant index.
        // Better to read from stored data? For simplicity, just rely on insertion order after sort logic in generation.
        // Actually, we need to sort by label then by variant index.
        // We need to store variant index on DOM or retrieve it.
    });
    // Simple re-render is safer for indices
    reRenderReviewGrid();
}

function reRenderReviewGrid() {
    var sprites = window._ccReviewData.sprites;
    sprites.sort(function(a, b) {
        if (a.label === b.label) return a.index - b.index;
        return EMOTION_LABELS.indexOf(a.label) - EMOTION_LABELS.indexOf(b.label);
    });

    var h = '';
    for (var i = 0; i < sprites.length; i++) {
        h += createReviewItemHTML(sprites[i], i);
    }
    $('#cc-review-grid').html(h);
}

function hideEmotionReviewModal() {
    $('#cc-review-overlay').remove();
    window._ccReviewData = null;
}

/* Upload generated sprites (Updated for variants) */
async function uploadSpritesToCharacter(charName, sprites) {
    var headers = {};
    if (scriptModule && typeof scriptModule.getRequestHeaders === 'function') {
        try { headers = scriptModule.getRequestHeaders(); } catch (e) {}
    }

    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        try {
            var blob = b64ToBlob(sprite.b64, 'image/png');
            var fd = new FormData();

            // Naming logic: joy.png or joy-1.png
            var filename = sprite.label;
            if (sprite.index > 0) {
                filename += '-' + sprite.index;
            }

            fd.append('name', charName);
            fd.append('label', sprite.label); // API might expect just label
            // ST API usually handles the file content.
            // We need to send the file with the correct name.
            // The /api/sprites/upload endpoint might rename it based on label.
            // Let's check how ST handles variants.
            // If ST expects label 'joy' for all, it might overwrite.
            // Usually, we need to upload file with specific name.
            // Using direct upload hack if API fails.

            fd.append('avatar', blob, filename + '.png');

            var authHeaders = {};
            for (var k in headers) {
                if (k.toLowerCase() !== 'content-type') authHeaders[k] = headers[k];
            }

            // Try standard upload
            var r = await fetch('/api/sprites/upload', {
                method: 'POST',
                headers: authHeaders,
                body: fd
            });

            if (!r.ok) {
                // Fallback direct write
                await uploadSpriteDirectly(charName, filename, sprite.b64, authHeaders);
            } else {
                // Some ST versions might rename file to {label}.png ignoring our filename.
                // To support variants, we might need to move/rename after upload.
                // But direct write is robust.
                // Let's rely on direct write for variants to ensure naming.
                // Actually, let's force direct write for variants if index > 0?
                // For simplicity, let's try the direct write method for ALL to ensure correct naming.
                 await uploadSpriteDirectly(charName, filename, sprite.b64, authHeaders);
            }

            L('Uploaded sprite:', filename, 'for', charName);
        } catch (e) {
            E('Failed to upload sprite', sprite.label, 'variant', sprite.index, ':', e.message);
        }
    }
}

// Direct sprite upload (Updated to accept filename)
async function uploadSpriteDirectly(charName, filename, b64, headers) {
    try {
        // Construct path: /characters/CharName/expressions/joy.png or joy-1.png
        // SillyTavern serves static files.
        // Note: This requires the extension to have write access to the file system (usually true for local ST).

        var blob = b64ToBlob(b64, 'image/png');

        // Endpoint to save file? ST doesn't have a generic "save file" API exposed easily for extensions without CSRF.
        // But /api/sprites/upload is the intended way.
        // If /api/sprites/upload ignores filename, we might be in trouble for variants.
        // However, let's assume we use the direct PUT approach which works in many setups or just the standard API.

        // Let's stick to the standard API structure but maybe check if we can hint the filename.
        // If not, we can use the `uploadSpriteDirectly` via custom route if available.
        // Assuming the user is on a recent ST version.

        // Method: Use fetch to put file to a specific URL if server allows.
        // ST has /api/sprites/upload-sprite?name=CharName&label=joy
        // We can try to use label parameter with the full name 'joy-1'.

        var fd = new FormData();
        fd.append('avatar', blob, filename + '.png');
        fd.append('name', charName);
        fd.append('label', filename); // Trying to pass 'joy-1' as label to see if API accepts it

        var r = await fetch('/api/sprites/upload', {
             method: 'POST',
             headers: headers,
             body: fd
        });

        if (!r.ok) {
            // Final fallback: Try constructing a custom endpoint logic or just throw
            throw new Error("Sprite upload failed");
        }

    } catch (e) {
        E('Direct sprite upload failed:', e.message);
    }
}

function addEmotionPreview(label, index, b64) {
    var $preview = $('#cc-emo-preview');
    var displayName = label + (index > 0 ? '-'+index : '');
    $preview.append('<div style="display:flex;flex-direction:column;align-items:center"><img src="data:image/png;base64,' + b64 + '"><div class="cc-emo-label">' + esc(displayName) + '</div></div>');

    var done = $preview.find('img').length;
    var total = EMOTION_LABELS.length * (ccData.emotionVariantCount || 1);
    var pct = Math.round((done / total) * 100);
    $('#cc-emo-bar').css('width', pct + '%');
    $('#cc-emo-counter').text(done + ' / ' + total);
}


/* ══════════════════════════════════════
   EMOTIONS — UI Overlay (Preloader)
   ══════════════════════════════════════ */

function showEmotionsOverlay(total) {
    hideEmotionsOverlay(); /* Remove any existing */
    var h = '<div class="cc-emotions-overlay" id="cc-emotions-overlay">';
    h += '<div class="cc-emotions-spinner"></div>';
    h += '<div class="cc-emotions-title">🎭 ' + esc(T('emotionsGenerating')) + '</div>';
    h += '<div class="cc-emotions-status" id="cc-emo-status">Preparing...</div>';
    h += '<div class="cc-emotions-progress-wrap"><div class="cc-emotions-progress-bar" id="cc-emo-bar"></div></div>';
    h += '<div style="font-size:12px;color:rgba(255,255,255,.4)" id="cc-emo-counter">0 / ' + total + '</div>';
    h += '<div class="cc-emotions-preview" id="cc-emo-preview"></div>';
    h += '<div class="cc-emotions-cancel" id="cc-emo-cancel">✕ Cancel</div>';
    h += '</div>';
    $('body').append(h);

    $('#cc-emo-cancel').on('click', function () {
        ccEmotionsCancelled = true;
        $(this).text('Cancelling...').css('opacity', '.5');
    });
}

function updateEmotionsProgress(current, total, label) {
    var pct = Math.round(((current) / total) * 100);
    $('#cc-emo-bar').css('width', pct + '%');
    $('#cc-emo-status').text(T('emotionsProgress') + label + ' (' + (current + 1) + '/' + total + ')');
    $('#cc-emo-counter').text((current) + ' / ' + total);
}

function updateEmotionsStatus(text) {
    $('#cc-emo-status').text(text);
}

function updateEmotionsError(label, msg) {
    var $preview = $('#cc-emo-preview');
    $preview.append('<div style="display:flex;flex-direction:column;align-items:center"><div style="width:60px;height:60px;border-radius:6px;background:rgba(231,76,60,.15);display:flex;align-items:center;justify-content:center;border:1px solid rgba(231,76,60,.3);font-size:20px">⚠️</div><div class="cc-emo-label" style="color:rgba(231,76,60,.6)">' + esc(label) + '</div></div>');
}


function hideEmotionsOverlay() {
    $('#cc-emotions-overlay').remove();
}

/* ══════════════════════════════════════
   CONTEXT HELPERS
   ══════════════════════════════════════ */

function getTemplateBlock() {
    if (!ccData.templateText || !ccData.templateText.trim()) return '';
    var tmpl = ccData.templateText.trim();
    if (tmpl.length > 4000) tmpl = tmpl.substring(0, 4000) + '\n...[truncated]';
    return '\nSTYLE TEMPLATE — Match this writing style:\n--- TEMPLATE ---\n' + tmpl + '\n--- END ---\n\n';
}

function getRefImageBlock() {
    if (!ccData.refImageDesc || !ccData.refImageDesc.trim()) return '';
    return '\nREFERENCE IMAGE DESCRIPTION:\n' + ccData.refImageDesc + '\n\n';
}

function gatherContext() {
    var parts = [];
    if (ccData.simpleIdea) parts.push('Idea: ' + ccData.simpleIdea);
    var fields = [
        ['name','Name'],['race','Race'],['gender','Gender'],['age','Age'],
        ['height','Height'],['weight','Weight'],['musculature','Musculature'],
        ['hairColor','Hair Color'],['hairstyle','Hairstyle'],['eyeColor','Eye Color'],
        ['bustSize','Bust Size'],['buttocksSize','Buttocks Size'],['legLength','Leg Length'],
        ['alignment','Alignment'],['temperament','Temperament'],
        ['intelligence','Intelligence'],['memory','Memory'],['attention','Attention'],
        ['logic','Logic'],['voiceTimbre','Voice Timbre'],['mentalHealth','Mental Health'],
        ['diseases','Diseases'],['weapon','Weapon'],['abilities','Abilities'],
        ['languages','Languages'],['relationship','Relationship']
    ];
    if (ccSettings.showNSFW) {
        fields.push(
            ['penisLengthErect','Penis Length (erect)'],
            ['penisLengthFlaccid','Penis Length (flaccid)'],
            ['penisGirthErect','Penis Girth (erect)'],
            ['penisGirthFlaccid','Penis Girth (flaccid)'],
            ['scrotumSize','Scrotum Size'],
            ['ejaculationVolume','Ejaculation Volume']
        );
    }
    for (var i = 0; i < fields.length; i++) {
        if (ccData[fields[i][0]]) parts.push(fields[i][1] + ': ' + ccData[fields[i][0]]);
    }
    if (ccData.refImageDesc) parts.push('Reference Image: ' + ccData.refImageDesc);
    return parts.join('\n') || '(No details — be creative)';
}

function getLockedBlock() {
    var locked = [];
    if (!ccData.locked) return '';
    var keys = Object.keys(ccData.locked);
    for (var i = 0; i < keys.length; i++) {
        if (ccData.locked[keys[i]] && ccData[keys[i]]) {
            locked.push(keys[i] + ': ' + ccData[keys[i]]);
        }
    }
    if (!locked.length) return '';
    return '\nLOCKED FIELDS (do NOT change these, keep exact values):\n' + locked.join('\n') + '\n\n';
}

function gatherClothingBlock() {
    var lines = [];
    for (var i = 0; i < ccData.outfits.length; i++) {
        var o = ccData.outfits[i]; var slots = [];
        ['head', 'glasses', 'torso', 'arms', 'legs', 'feet', 'underwear', 'accessories'].forEach(function (s) {
            if (o[s]) slots.push(s + ': ' + o[s]);
        });
        if (slots.length) lines.push(o.name + ':\n  ' + slots.join('\n  '));
    }
    return lines.length ? '\nCLOTHING:\n' + lines.join('\n') + '\n\n' : '';
}

function getCurrentOutfitDesc() {
    var o = ccData.outfits[ccData.currentOutfitIdx]; if (!o) return '';
    var slots = [];
    ['head', 'glasses', 'torso', 'arms', 'legs', 'feet', 'underwear', 'accessories'].forEach(function (s) {
        if (o[s]) slots.push(s + ': ' + o[s]);
    });
    return slots.length ? 'Currently wearing (' + o.name + '):\n' + slots.join('\n') : '';
}

/* ══════════════════════════════════════
   LLM GENERATION FUNCTIONS
   ══════════════════════════════════════ */

async function doSimpleGenerate() {
    if (!genQuiet) throw new Error(T('noLLM'));
    var idea = ccData.simpleIdea.trim();
    if (!idea) throw new Error(T('ideaEmpty'));
    var prompt = PROMPTS.simpleGenerate.replace('{{IDEA}}', idea).replace('{{TEMPLATE_BLOCK}}', getTemplateBlock()).replace('{{REF_IMAGE_BLOCK}}', getRefImageBlock());
    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);
    if (!data || !data.description) throw new Error('Failed to parse LLM response.');

    var selectValidation = {
        gender: ['Male', 'Female', 'Non-binary', 'Genderless', 'Other'],
        musculature: ['Skinny', 'Slim', 'Average', 'Athletic', 'Muscular', 'Bodybuilder', 'Chubby', 'Overweight', 'Obese'],
        bustSize: ['N/A', 'Flat', 'Small', 'Medium', 'Large', 'Very Large'],
        alignment: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
        temperament: ['Choleric', 'Sanguine', 'Melancholic', 'Phlegmatic'],
        intelligence: ['Very Low', 'Low', 'Below Average', 'Average', 'Above Average', 'High', 'Very High', 'Genius'],
        memory: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Photographic'],
        attention: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Hyperfocused'],
        logic: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Exceptional'],
        voiceTimbre: ['High-pitched', 'Soft', 'Average', 'Deep', 'Very Deep', 'Raspy', 'Melodic', 'Whispery', 'Booming', 'Monotone'],
        relationship: ['Stranger', 'Friend', 'Best Friend', 'Lover', 'Spouse', 'Sibling', 'Parent', 'Child', 'Mentor', 'Student', 'Rival', 'Enemy', 'Servant', 'Master', 'Pet', 'Companion', 'Colleague', 'Other'],
        buttocksSize: ['Flat', 'Small', 'Average', 'Round', 'Large', 'Very Large'],
        legLength: ['Short', 'Below Average', 'Average', 'Long', 'Very Long'],
        scrotumSize: ['Small', 'Average', 'Large', 'Very Large', 'Enormous']
    };

    var fieldMap = {
        name: 'name', description: 'description', personality: 'personality',
        scenario: 'scenario', first_mes: 'firstMessage', mes_example: 'mesExample',
        race: 'race', gender: 'gender', age: 'age', height: 'height', weight: 'weight',
        musculature: 'musculature', hair_color: 'hairColor', hairstyle: 'hairstyle',
        eye_color: 'eyeColor', bust_size: 'bustSize', alignment: 'alignment',
        temperament: 'temperament', intelligence: 'intelligence', memory: 'memory',
        attention: 'attention', logic: 'logic', voice_timbre: 'voiceTimbre',
        mental_health: 'mentalHealth', diseases: 'diseases',
        weapon: 'weapon', abilities: 'abilities', languages: 'languages',
        relationship: 'relationship',
        buttocks_size: 'buttocksSize', leg_length: 'legLength',
        penis_length_erect: 'penisLengthErect', penis_length_flaccid: 'penisLengthFlaccid',
        penis_girth_erect: 'penisGirthErect', penis_girth_flaccid: 'penisGirthFlaccid',
        scrotum_size: 'scrotumSize', ejaculation_volume: 'ejaculationVolume'
    };

    for (var k in fieldMap) {
        if (!fieldMap.hasOwnProperty(k) || !data[k]) continue;
        var fk = fieldMap[k];
        if (isLocked(fk)) continue;
        var val = data[k];
        if (selectValidation[fk]) val = matchSelectOption(val, selectValidation[fk]);
        ccData[fk] = val;
    }
    L('Simple generate done:', ccData.name);
    return data;
}

async function doAdvancedGenerate() {
    if (!genQuiet) throw new Error(T('noLLM'));
    var prompt = PROMPTS.advancedGenerate
        .replace('{{ATTRIBUTES}}', gatherContext())
        .replace('{{CLOTHING_BLOCK}}', gatherClothingBlock())
        .replace('{{TEMPLATE_BLOCK}}', getTemplateBlock())
        .replace('{{REF_IMAGE_BLOCK}}', getRefImageBlock());
    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);
    if (!data || !data.description) throw new Error('Failed to parse LLM response.');
    setField('description', data.description);
    if (data.personality) setField('personality', data.personality);
    if (data.scenario) setField('scenario', data.scenario);
    if (data.first_mes) setField('firstMessage', data.first_mes);
    if (data.mes_example) setField('mesExample', data.mes_example);
    return data;
}

async function doGenerateField(fieldKey, fieldLabel, selectOptions) {
    if (!genQuiet) throw new Error(T('noLLM'));
    var context = gatherContext();
    var contextIsEmpty = !ccData.simpleIdea && !ccData.name && !ccData.race && !ccData.gender;
    var randomHint = contextIsEmpty
        ? 'No character info provided yet. Generate a COMPLETELY RANDOM and CREATIVE value.\n\n'
        : '';
    var optsHint = '';
    if (selectOptions && selectOptions.length) {
        optsHint = 'You MUST choose EXACTLY one of these values: ' + selectOptions.join(', ') + '\nOutput ONLY the chosen value, nothing else.\n\n';
    }
    var prompt = '[OOC: You are filling in a character attribute.\n\n' +
        randomHint +
        'KNOWN INFO:\n' + context + '\n\n' +
        optsHint +
        'Generate a value for "' + fieldLabel + '".\n' +
        'Be creative and varied.\n' +
        (ccData[fieldKey] ? 'Current value is: "' + ccData[fieldKey] + '". Generate something NEW and DIFFERENT.\n\n' : '\n') +
        'Respond with ONLY the value — a brief phrase or word. No JSON, no explanation. ' +
        'Write in the same language as the context.]';

    var raw = await ccGenQuiet(prompt);
    var value = raw.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/^\d+[\)\.\:]\s*/, '').trim();

    if (selectOptions && selectOptions.length) {
        var lower = value.toLowerCase();
        var matched = null;
        for (var i = 0; i < selectOptions.length; i++) {
            if (selectOptions[i].toLowerCase() === lower) { matched = selectOptions[i]; break; }
        }
        if (!matched) {
            for (var j = 0; j < selectOptions.length; j++) {
                if (lower.indexOf(selectOptions[j].toLowerCase()) !== -1 || selectOptions[j].toLowerCase().indexOf(lower) !== -1) { matched = selectOptions[j]; break; }
            }
        }
        if (matched) value = matched;
        else value = selectOptions[Math.floor(Math.random() * selectOptions.length)];
    }

    ccData[fieldKey] = value;
    L('Generated field', fieldKey, '=', value);
    return value;
}

async function doGenerateAllFields() {
    if (!genQuiet) throw new Error(T('noLLM'));

    var ctxParts = [];
    if (ccData.simpleIdea) ctxParts.push('Idea: ' + ccData.simpleIdea);

    // Collect every field that can be generated
    var allFields = [
        ['name','Name'],['race','Race'],['gender','Gender'],['age','Age'],
        ['height','Height'],['weight','Weight'],['musculature','Musculature'],
        ['hairColor','Hair Color'],['hairstyle','Hairstyle'],['eyeColor','Eye Color'],
        ['bustSize','Bust Size'],['buttocksSize','Buttocks Size'],['legLength','Leg Length'],
        ['alignment','Alignment'],['temperament','Temperament'],
        ['intelligence','Intelligence'],['memory','Memory'],['attention','Attention'],
        ['logic','Logic'],['voiceTimbre','Voice Timbre'],['mentalHealth','Mental Health'],
        ['diseases','Diseases'],['weapon','Weapon'],['abilities','Abilities'],
        ['languages','Languages'],['relationship','Relationship']
    ];

    // Add NSFW fields if enabled
    if (ccSettings.showNSFW) {
        allFields.push(
            ['penisLengthErect','Penis Length (erect)'],
            ['penisLengthFlaccid','Penis Length (flaccid)'],
            ['penisGirthErect','Penis Girth (erect)'],
            ['penisGirthFlaccid','Penis Girth (flaccid)'],
            ['scrotumSize','Scrotum Size'],
            ['ejaculationVolume','Ejaculation Volume']
        );
    }

    // Filter fields: generate only those that are NOT locked
    var toGen = [];
    for (var fi = 0; fi < allFields.length; fi++) {
        var fk = allFields[fi][0];

        // 1. If the field is locked individually (per-field lock)
        if (isLocked(fk)) {
            // Feed locked values into the context so the LLM accounts for them
            if (ccData[fk]) ctxParts.push(allFields[fi][1] + ': ' + ccData[fk]);
            continue;
        }

        // 2. If the whole section is locked (group-header lock)
        var sectionId = SECTION_MAP[fk];
        if (sectionId && isSectionLocked(sectionId)) {
            // Add to the context if data exists
            if (ccData[fk]) ctxParts.push(allFields[fi][1] + ': ' + ccData[fk]);
            continue;
        }

        toGen.push(fk);
    }

    // Add the reference description if present
    if (ccData.refImageDesc) ctxParts.push('Reference Image: ' + ccData.refImageDesc);

    var cleanContext = ctxParts.join('\n') || '(No details — be fully creative)';
    var contextIsEmpty = !ccData.simpleIdea && ctxParts.length <= 1;

    // Strict instruction for the LLM
    var randomBlock = contextIsEmpty
        ? '\nCRITICAL: No character information is provided above. You must generate a COMPLETELY RANDOM and FICTIONAL character. DO NOT use information about the user, the chat context, or existing characters. Be original.\n\n'
        : '\nIMPORTANT: Use the provided character info. Do not import outside context.\n\n';

    var regenBlock = '\nIMPORTANT: Generate COMPLETELY NEW and FRESH values for ALL fields.\n\n';

    var prompt = PROMPTS.generateAllFields
        .replace('{{CONTEXT}}', cleanContext)
        .replace('{{LOCKED_BLOCK}}', getLockedBlock()) // In case there is extra-block logic there
        .replace('{{REF_IMAGE_BLOCK}}', getRefImageBlock());

    prompt = prompt.replace('Fill in every field.', randomBlock + regenBlock + 'Fill in every field.');

    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);
    if (!data) throw new Error('Failed to parse LLM response.');

    var map = {
        name: 'name', race: 'race', gender: 'gender', age: 'age', weight: 'weight',
        height: 'height', musculature: 'musculature', hairColor: 'hairColor',
        hairstyle: 'hairstyle', eyeColor: 'eyeColor', bustSize: 'bustSize',
        buttocksSize: 'buttocksSize', legLength: 'legLength',
        alignment: 'alignment', temperament: 'temperament', intelligence: 'intelligence',
        memory: 'memory', attention: 'attention', logic: 'logic', voiceTimbre: 'voiceTimbre',
        mentalHealth: 'mentalHealth', diseases: 'diseases', weapon: 'weapon',
        abilities: 'abilities', languages: 'languages', relationship: 'relationship',
        penisLengthErect: 'penisLengthErect', penisLengthFlaccid: 'penisLengthFlaccid',
        penisGirthErect: 'penisGirthErect', penisGirthFlaccid: 'penisGirthFlaccid',
        scrotumSize: 'scrotumSize', ejaculationVolume: 'ejaculationVolume',
        hair_color: 'hairColor', eye_color: 'eyeColor', bust_size: 'bustSize',
        buttocks_size: 'buttocksSize', leg_length: 'legLength',
        voice_timbre: 'voiceTimbre', mental_health: 'mentalHealth',
        penis_length_erect: 'penisLengthErect', penis_length_flaccid: 'penisLengthFlaccid',
        penis_girth_erect: 'penisGirthErect', penis_girth_flaccid: 'penisGirthFlaccid',
        scrotum_size: 'scrotumSize', ejaculation_volume: 'ejaculationVolume'
    };

    var selectValidation = {
        gender: ['Male', 'Female', 'Non-binary', 'Genderless', 'Other'],
        musculature: ['Skinny', 'Slim', 'Average', 'Athletic', 'Muscular', 'Bodybuilder', 'Chubby', 'Overweight', 'Obese'],
        bustSize: ['N/A', 'Flat', 'Small', 'Medium', 'Large', 'Very Large'],
        buttocksSize: ['Flat', 'Small', 'Average', 'Round', 'Large', 'Very Large'],
        legLength: ['Short', 'Below Average', 'Average', 'Long', 'Very Long'],
        alignment: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
        temperament: ['Choleric', 'Sanguine', 'Melancholic', 'Phlegmatic'],
        intelligence: ['Very Low', 'Low', 'Below Average', 'Average', 'Above Average', 'High', 'Very High', 'Genius'],
        memory: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Photographic'],
        attention: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Hyperfocused'],
        logic: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Exceptional'],
        voiceTimbre: ['High-pitched', 'Soft', 'Average', 'Deep', 'Very Deep', 'Raspy', 'Melodic', 'Whispery', 'Booming', 'Monotone'],
        relationship: ['Stranger', 'Friend', 'Best Friend', 'Lover', 'Spouse', 'Sibling', 'Parent', 'Child', 'Mentor', 'Student', 'Rival', 'Enemy', 'Servant', 'Master', 'Pet', 'Companion', 'Colleague', 'Other'],
        scrotumSize: ['Small', 'Average', 'Large', 'Very Large', 'Enormous']
    };

    // Apply data ONLY to the fields we intended to generate (toGen)
    // and which are not locked (a double-check just in case)
    for (var k in map) {
        if (!map.hasOwnProperty(k)) continue;
        var fieldKey = map[k];

        // If the field is not on the generation list, skip it
        if (toGen.indexOf(fieldKey) === -1) continue;

        var val = data[k];
        if (val === 'N/A') continue;
        if (!val) continue;

        // Technical guard: if the field is locked (despite filtering above), do not overwrite
        if (isLocked(fieldKey)) continue;

        if (selectValidation[fieldKey]) val = matchSelectOption(val, selectValidation[fieldKey]);
        ccData[fieldKey] = val;
    }
    L('All fields generated');
    return data;
}

async function doGenerateTabFields(tabId) {
    if (!genQuiet) throw new Error(T('noLLM'));

    // Map tab ID to the list of fields to generate
    var tabFieldMap = {
        basic: ['name', 'race', 'gender', 'age', 'relationship'],
        appearance: (function () {
            var f = ['height', 'weight', 'musculature', 'bustSize', 'buttocksSize', 'legLength', 'hairColor', 'hairstyle', 'eyeColor'];
            // Add NSFW fields only if the setting is enabled
            if (ccSettings.showNSFW) f.push('penisLengthErect', 'penisLengthFlaccid', 'penisGirthErect', 'penisGirthFlaccid', 'scrotumSize', 'ejaculationVolume');
            return f;
        })(),
        mind: ['alignment', 'temperament', 'intelligence', 'memory', 'attention', 'logic', 'voiceTimbre', 'mentalHealth', 'diseases'],
        abilities: ['weapon', 'abilities', 'languages']
    };

    var fields = tabFieldMap[tabId];
    if (!fields || !fields.length) throw new Error('No generatable fields on this tab.');

    // Collect the fields to generate, excluding locked ones
    var toGen = [];
    for (var i = 0; i < fields.length; i++) {
        var fk = fields[i];

        // 1. Check the field lock
        if (isLocked(fk)) continue;

        // 2. Check the section lock (skip the field if the section is locked)
        var sectionId = SECTION_MAP[fk];
        if (sectionId && isSectionLocked(sectionId)) continue;

        toGen.push(fk);
    }

    if (!toGen.length) throw new Error('All fields on this tab are locked.');

    // Bug fix
    // Use gatherContext(), which collects ALL known character data (name, race, gender, etc.)
    var context = gatherContext();
    // Check whether the context is empty
    var contextIsEmpty = !ccData.simpleIdea && !ccData.name && !ccData.race && !ccData.gender;

    // Add a firm instruction for the LLM to follow the context (especially gender)
    var genderConsistencyBlock = '';
    if (ccData.gender) {
        genderConsistencyBlock = '\nCRITICAL: The character gender is "' + ccData.gender + '". You MUST generate fields consistent with this gender (e.g. do not generate male anatomy for females).\n';
    }

    var randomBlock = contextIsEmpty
        ? '\nCRITICAL: No character information is provided above. You must generate a COMPLETELY RANDOM and FICTIONAL character. DO NOT use information about the user, the chat context, or existing characters. Be original.\n\n'
        : '\nIMPORTANT: Use the provided character info. Do not import outside context.\n\n';

    // Reference of valid values for select fields
    var selectValidation = {
        gender: ['Male', 'Female', 'Non-binary', 'Genderless', 'Other'],
        musculature: ['Skinny', 'Slim', 'Average', 'Athletic', 'Muscular', 'Bodybuilder', 'Chubby', 'Overweight', 'Obese'],
        bustSize: ['N/A', 'Flat', 'Small', 'Medium', 'Large', 'Very Large'],
        alignment: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
        temperament: ['Choleric', 'Sanguine', 'Melancholic', 'Phlegmatic'],
        intelligence: ['Very Low', 'Low', 'Below Average', 'Average', 'Above Average', 'High', 'Very High', 'Genius'],
        memory: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Photographic'],
        attention: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Hyperfocused'],
        logic: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Exceptional'],
        voiceTimbre: ['High-pitched', 'Soft', 'Average', 'Deep', 'Very Deep', 'Raspy', 'Melodic', 'Whispery', 'Booming', 'Monotone'],
        relationship: ['Stranger', 'Friend', 'Best Friend', 'Lover', 'Spouse', 'Sibling', 'Parent', 'Child', 'Mentor', 'Student', 'Rival', 'Enemy', 'Servant', 'Master', 'Pet', 'Companion', 'Colleague', 'Other'],
        buttocksSize: ['Flat', 'Small', 'Average', 'Round', 'Large', 'Very Large'],
        legLength: ['Short', 'Below Average', 'Average', 'Long', 'Very Long'],
        scrotumSize: ['Small', 'Average', 'Large', 'Very Large', 'Enormous']
    };

    // Build the field descriptions for the prompt
    var fieldDesc = toGen.map(function (fk) {
        var hint = selectValidation[fk] ? ' (choose from: ' + selectValidation[fk].join(', ') + ')' : '';
        var cur = ccData[fk] ? ' [current: "' + ccData[fk] + '" — generate something DIFFERENT]' : '';
        return '"' + fk + '"' + hint + cur;
    }).join('\n');

    // Gather info on locked fields so the LLM does not change it (just in case)
    var lockedInfo = '';
    for (var j = 0; j < fields.length; j++) {
        if (isLocked(fields[j]) && ccData[fields[j]]) {
            lockedInfo += fields[j] + ': ' + ccData[fields[j]] + '\n';
        }
    }
    var lockedBlock = lockedInfo ? '\nLOCKED (keep these):\n' + lockedInfo + '\n' : '';

    // Final prompt
    // Note the added genderConsistencyBlock
    var prompt = '[OOC: You are a character creation assistant. Generate values for these specific fields ONLY.\n\n' +
        randomBlock +
        genderConsistencyBlock +
        'KNOWN CHARACTER INFO:\n' + (contextIsEmpty ? '(Generate random character)' : context) + '\n\n' +
        lockedBlock +
        'FIELDS TO GENERATE:\n' + fieldDesc + '\n\n' +
        'Be creative and varied.\n' +
        'For select fields, use EXACTLY one of the listed values.\n' +
        'Write in the same language as the context.\n\n' +
        'Respond ONLY with JSON containing these field keys:\n{' +
        toGen.map(function (f) { return '"' + f + '": ""'; }).join(', ') +
        '}\nONLY valid JSON!]';

    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);
    if (!data) throw new Error('Failed to parse LLM response.');

    // Apply the received data
    for (var k = 0; k < toGen.length; k++) {
        var fk2 = toGen[k];
        var val = data[fk2];
        if (!val || val === 'N/A') continue;
        // Validate select fields
        if (selectValidation[fk2]) val = matchSelectOption(val, selectValidation[fk2]);
        ccData[fk2] = val;
    }

    L('Tab fields generated for:', tabId);
    return data;
}



async function doGenerateAltGreeting() {
    if (!genQuiet) throw new Error(T('noLLM'));
    var desc = ccData.description || gatherContext();
    var prompt = PROMPTS.generateAltGreeting
        .replace('{{DESCRIPTION}}', desc.substring(0, 2000))
        .replace('{{FIRST_MES}}', ccData.firstMessage || '(none)');
    var raw = await ccGenQuiet(prompt);
    if (raw.trim()) ccData.altGreetings.push(raw.trim());
    return raw.trim();
}

async function doEnhanceField(fieldKey, fieldLabel) {
    if (!genQuiet) throw new Error(T('noLLM'));

    var context = gatherContext();
    var currentText = ccData[fieldKey] || '';

    // If the field is empty, generate from scratch but in detail
    if (!currentText.trim()) {
        var genPrompt = '[OOC: Generate detailed content for the character field "{{FIELD_NAME}}".\n\nCONTEXT:\n{{CONTEXT}}\n\nWrite a detailed, artistic entry. Output ONLY the text.]'
            .replace('{{FIELD_NAME}}', fieldLabel)
            .replace('{{CONTEXT}}', context);
        var rawGen = await ccGenQuiet(genPrompt);
        ccData[fieldKey] = rawGen.trim();
    } else {
        // Otherwise enhance the existing value
        var prompt = PROMPTS.enhanceField
            .replace('{{CONTEXT}}', context)
            .replace('{{FIELD_NAME}}', fieldLabel)
            .replace('{{CURRENT_TEXT}}', currentText);

        var raw = await ccGenQuiet(prompt);
        ccData[fieldKey] = raw.trim();
    }

    L('Enhanced field', fieldKey);
    return ccData[fieldKey];
}

async function doEnhanceAltGreeting(index) {
    if (!genQuiet) throw new Error(T('noLLM'));

    var context = gatherContext();
    var currentText = ccData.altGreetings[index] || '';

    if (!currentText.trim()) return; // Do not enhance an empty value

    var prompt = PROMPTS.enhanceField
        .replace('{{CONTEXT}}', context)
        .replace('{{FIELD_NAME}}', 'Alternative Greeting')
        .replace('{{CURRENT_TEXT}}', currentText);

    var raw = await ccGenQuiet(prompt);
    ccData.altGreetings[index] = raw.trim();

    L('Enhanced alt greeting at index', index);
    return ccData.altGreetings[index];
}

/* ══════════════════════════════════════
   IMAGE CAPTION (mirrors DirectAsk approach)
   ══════════════════════════════════════ */

async function ccMakeHeaders() {
    if (scriptModule && typeof scriptModule.getRequestHeaders === 'function')
        try { return scriptModule.getRequestHeaders(); } catch (e) {}
    var h = { 'Content-Type': 'application/json' };
    try { var r = await fetch('/csrf-token'); if (r.ok) { var d = await r.json(); if (d.token) h['X-CSRF-Token'] = d.token; } } catch (e) {}
    return h;
}

async function ccCaptionImage(base64) {
    // Read caption extension settings
    var icSettings = (extSettings && extSettings['caption']) || {};
    var captionPrompt = icSettings.prompt || PROMPTS.describeImage;
    var source        = icSettings.source || 'extras';
    var mmApi         = icSettings.multimodal_api   || 'openrouter';
    var mmModel       = icSettings.multimodal_model || '';

    var dataUrl = base64.startsWith('data:') ? base64 : 'data:image/png;base64,' + base64;
    var b64only = dataUrl.indexOf(',') !== -1 ? dataUrl.slice(dataUrl.indexOf(',') + 1) : base64;

    var headers = await ccMakeHeaders();

    if (source === 'multimodal') {
        L('ccCaptionImage → multimodal, api:', mmApi, 'model:', mmModel);
        try {
            var visionBody = {
                chat_completion_source: mmApi,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: dataUrl } },
                        { type: 'text', text: captionPrompt }
                    ]
                }],
                max_tokens: 600,
                stream: false
            };
            if (mmModel) visionBody.model = mmModel;
            var vr = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST', headers: headers, body: JSON.stringify(visionBody)
            });
            if (vr.ok) {
                var vd = await vr.json();
                var vcap = vd && vd.choices && vd.choices[0] &&
                           (vd.choices[0].message && vd.choices[0].message.content || vd.choices[0].text);
                if (vcap && vcap.trim()) { L('ccCaptionImage OK via chat-completions'); return vcap.trim(); }
            } else {
                var et = await vr.text().catch(function(){ return ''; });
                L('ccCaptionImage ST backend HTTP', vr.status, et.slice(0, 200));
            }
        } catch(e) { L('ccCaptionImage multimodal failed:', e.message); }
    }

    // Fallback: /api/extra/caption (Extras backend)
    try {
        var er = await fetch('/api/extra/caption', {
            method: 'POST', headers: headers,
            body: JSON.stringify({ image: b64only, prompt: captionPrompt })
        });
        if (er.ok) {
            var ed = await er.json();
            if (ed && ed.caption) { L('ccCaptionImage OK via extras'); return ed.caption.trim(); }
        }
    } catch(e) { L('ccCaptionImage extras fallback failed:', e.message); }

    throw new Error('Caption API unavailable. Check Image Captioning extension settings.');
}

async function doDescribeRefImage() {
    if (!ccData.refImageBase64) throw new Error('No reference image loaded.');
    var desc = await ccCaptionImage(ccData.refImageBase64);
    ccData.refImageDesc = desc;
    return ccData.refImageDesc;
}

function gatherImageContext() {
    var parts = [];
    if (ccData.name) parts.push('Name: ' + ccData.name);
    if (ccData.race) parts.push('Race/Species: ' + ccData.race);
    if (ccData.gender) parts.push('Gender: ' + ccData.gender);
    if (ccData.age) parts.push('Age: ' + ccData.age);
    if (ccData.height) parts.push('Height: ' + ccData.height);
    if (ccData.weight) parts.push('Weight: ' + ccData.weight);
    if (ccData.musculature) parts.push('Body type/Musculature: ' + ccData.musculature);
    if (ccData.bustSize && ccData.bustSize !== 'N/A') parts.push('Bust size: ' + ccData.bustSize);
    if (ccData.buttocksSize) parts.push('Buttocks: ' + ccData.buttocksSize);
    if (ccData.legLength) parts.push('Legs: ' + ccData.legLength);
    if (ccData.hairColor) parts.push('Hair color: ' + ccData.hairColor);
    if (ccData.hairstyle) parts.push('Hairstyle: ' + ccData.hairstyle);
    if (ccData.eyeColor) parts.push('Eye color: ' + ccData.eyeColor);
    if (ccData.description) parts.push('\nDETAILED DESCRIPTION:\n' + ccData.description.substring(0, 1500));
    if (ccData.personality) parts.push('\nPersonality: ' + ccData.personality.substring(0, 300));
    if (ccData.refImageDesc) parts.push('\nReference image description: ' + ccData.refImageDesc.substring(0, 500));
    return parts.join('\n');
}

async function doGenerateImage(imageType) {
    var preset = getAIActivePreset();
    if (!preset || !preset.workflow) throw new Error(T('noPreset'));
    var name = ccData.name || 'Character';
    var fullDetails = gatherImageContext();
    var outfitBlock = getCurrentOutfitDesc();

    var typeLabel;
    if (imageType === 'face') typeLabel = 'FACE close-up (head and neck only)';
    else if (imageType === 'fullbody') typeLabel = 'FULL BODY standing pose (entire body visible)';
    else typeLabel = 'PORTRAIT (face + upper body, waist up)';

    var prompt = PROMPTS.portraitPrompt
        .replace('{{NAME}}', name)
        .replace('{{FULL_DETAILS}}', fullDetails)
        .replace('{{OUTFIT_BLOCK}}', outfitBlock ? 'CURRENT OUTFIT:\n' + outfitBlock + '\n\n' : '')
        .replace('{{IMAGE_TYPE}}', typeLabel)
        .replace('{{FORMAT_HINT}}', getFormatHint());

    var raw = await ccGenQuiet(prompt);
    var data = parseJSON(raw);
    var imagePrompt = (data && data.image_prompt) ? data.image_prompt : (raw.trim().substring(0, 500));
    if (!imagePrompt) throw new Error('Failed to generate image prompt.');

    var baseW = preset.width || 1024, baseH = preset.height || 768;
    var area = Math.max(baseW * baseH, 262144);
    var pW, pH;
    if (imageType === 'face') {
        pW = pH = Math.round(Math.sqrt(area) / 64) * 64;
    } else if (imageType === 'fullbody') {
        pW = Math.round(Math.sqrt(area * 2 / 3) / 64) * 64;
        pH = Math.round(Math.sqrt(area * 3 / 2) / 64) * 64;
    } else {
        pW = Math.round(Math.sqrt(area * 3 / 4) / 64) * 64;
        pH = Math.round(Math.sqrt(area * 4 / 3) / 64) * 64;
    }
    pW = Math.max(512, pW); pH = Math.max(512, pH);

    var neg = (preset.negativePrompt) || '';

    // Pre-upload the image to get its name if a standard node is used
    var uploadedInputName = '';
    if (ccData.useRefAsCharAvatar && ccData.refImageBase64) {
        try {
            uploadedInputName = await comfyUploadImage(ccData.refImageBase64, 'cc_input_' + Date.now() + '.png');
        } catch(e) {
            console.warn('Failed to upload input image to ComfyUI:', e);
        }
    }

    var wfObj = fillWorkflow(preset.workflow, imagePrompt, neg, pW, pH, preset, uploadedInputName);
    if (!wfObj) throw new Error('Failed to parse workflow.');
    var b64 = await comfyGenerate(wfObj);
    if (!b64) throw new Error('Image generation returned no result.');

    if (imageType === 'face') ccData.generatedFaceBase64 = b64;
    else if (imageType === 'fullbody') ccData.generatedFullbodyBase64 = b64;
    else ccData.generatedPortraitBase64 = b64;
    return b64;
}

/* ══════════════════════════════════════
   CREATE CHARACTER VIA API
   ══════════════════════════════════════ */

async function doCreateCharacter() {
    var name = ccData.name;
    if (!name || !name.trim()) throw new Error(T('nameRequired'));
    var authHeaders = {};
    if (scriptModule && typeof scriptModule.getRequestHeaders === 'function') {
        try { var rh = scriptModule.getRequestHeaders(); for (var k in rh) { if (k.toLowerCase() !== 'content-type') authHeaders[k] = rh[k]; } } catch (e) {}
    }
    var avatarBlob = null;
    var imgSrc = null;
    if (ccData.avatarSource === 'face') imgSrc = ccData.generatedFaceBase64;
    else if (ccData.avatarSource === 'fullbody') imgSrc = ccData.generatedFullbodyBase64;
    else if (ccData.avatarSource === 'ref') imgSrc = ccData.refImageBase64;
    else imgSrc = ccData.generatedPortraitBase64;

    // If nothing is selected, fall back to any available image (including the reference)
    if (!imgSrc) imgSrc = ccData.generatedPortraitBase64 || ccData.generatedFaceBase64 || ccData.generatedFullbodyBase64 || ccData.refImageBase64;
    if (imgSrc) {
        avatarBlob = b64ToBlob(imgSrc, 'image/png');
    } else {
        try {
            var cv = document.createElement('canvas'); cv.width = 400; cv.height = 600;
            var cx = cv.getContext('2d'); cx.fillStyle = '#2c2c2c'; cx.fillRect(0, 0, 400, 600);
            cx.fillStyle = '#64b4ff'; cx.font = 'bold 140px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
            cx.fillText(name.charAt(0).toUpperCase(), 200, 280);
            avatarBlob = await new Promise(function (r) { cv.toBlob(r, 'image/png'); });
        } catch (e) {}
    }

    var descParts = [];
    if (ccData.description) descParts.push(ccData.description.trim());
    if (ccData.personality && ccData.personality.trim()) descParts.push('### Personality\n' + ccData.personality.trim());
    if (ccData.scenario && ccData.scenario.trim()) descParts.push('### Scenario\n' + ccData.scenario.trim());
    if (ccData.mesExample && ccData.mesExample.trim()) descParts.push('### Message Examples\n' + ccData.mesExample.trim());
    var combinedDescription = descParts.join('\n\n');

    var fd = new FormData();
    if (avatarBlob) fd.append('avatar', avatarBlob, name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png');
    fd.append('name', name); fd.append('ch_name', name);
    fd.append('description', combinedDescription);
    fd.append('personality', ccData.personality || '');
    fd.append('first_mes', ccData.firstMessage || '');
    fd.append('scenario', ccData.scenario || '');
    fd.append('mes_example', ccData.mesExample || '');
    fd.append('creator_notes', ''); fd.append('system_prompt', '');
    fd.append('post_history_instructions', '');
    fd.append('tags', JSON.stringify([])); fd.append('creator', 'Character Creator');
    fd.append('character_version', '');
    if (ccData.altGreetings && ccData.altGreetings.length > 0) {
    ccData.altGreetings.forEach(function (greeting) {
        if (greeting && greeting.trim()) {
            fd.append('alternate_greetings', greeting.trim());
        }
    });
}
    fd.append('extensions', '{}'); fd.append('talkativeness', '0.5');
    fd.append('fav', 'false'); fd.append('spec', 'chara_card_v2'); fd.append('spec_version', '2.0');
    var r = await fetch('/api/characters/create', { method: 'POST', headers: authHeaders, body: fd });
    if (!r.ok) { var et = ''; try { et = await r.text(); } catch (e) {} throw new Error('Failed: ' + r.status + ' ' + et); }
    await new Promise(function (re) { setTimeout(re, 1000); });
    try { if (scriptModule && typeof scriptModule.getCharacters === 'function') await scriptModule.getCharacters(); } catch (e) {}
    return name;
}

/* ══════════════════════════════════════
   UI — PANEL
   ══════════════════════════════════════ */

function buildPanel() {
    if (document.getElementById('cc-panel')) return;
    var h = '<div id="cc-panel-overlay"></div><div id="cc-panel">';

    /* Header */
    h += '<div class="cc-header"><div class="cc-header-title"><i class="fa-solid fa-user-plus"></i> <span id="cc-title-text">' + esc(T('title')) + '</span></div>';
    h += '<button class="cc-hdr-btn menu_button" id="cc-h-tr" title="Translate"><i class="fa-solid fa-language"></i></button>';
    h += '<button class="cc-hdr-btn menu_button" id="cc-h-reset" title="Reset"><i class="fa-solid fa-rotate-left"></i></button>';
    h += '<button class="cc-hdr-btn menu_button" id="cc-h-close" title="Close"><i class="fa-solid fa-xmark"></i></button></div>';

    /* Mode */
    h += '<div style="padding:10px 16px 0"><div class="cc-mode-switch">';
    h += '<div class="cc-mode-btn active" data-mode="simple">✨ ' + esc(T('simple')) + '</div>';
    h += '<div class="cc-mode-btn" data-mode="advanced">⚙️ ' + esc(T('advanced')) + '</div></div></div>';

    /* Tabs */
    h += '<div class="cc-tabs" id="cc-tabs" style="display:none">';
    var tabs = [['basic', T('basic')], ['appearance', T('appearance')], ['mind', T('mind')], ['clothing', T('clothing')], ['abilities', T('abilities')], ['card', T('card')]];
    for (var ti = 0; ti < tabs.length; ti++) h += '<div class="cc-tab' + (ti === 0 ? ' active' : '') + '" data-tab="' + tabs[ti][0] + '">' + esc(tabs[ti][1]) + '</div>';
    h += '</div>';

    h += '<div class="cc-status-bar" id="cc-status" style="display:none"></div>';
    h += '<div class="cc-body" id="cc-body"></div>';

        /* Footer */
    h += '<div class="cc-footer">';
    h += '<button class="menu_button cc-btn-primary" id="cc-f-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + esc(T('generate')) + '</button>';
    h += '<button class="menu_button" id="cc-f-genface" style="display:none"><i class="fa-solid fa-circle-user"></i> ' + esc(T('face')) + '</button>';
    h += '<button class="menu_button" id="cc-f-genportrait" style="display:none"><i class="fa-solid fa-image-portrait"></i> ' + esc(T('portrait')) + '</button>';
    h += '<button class="menu_button" id="cc-f-genfull" style="display:none"><i class="fa-solid fa-person"></i> ' + esc(T('fullbody')) + '</button>';

    // Updated section with the variant-count input
    h += '<div class="cc-emotions-controls" id="cc-emotions-check-wrap" style="display:none; align-items: center; gap: 5px;">';
    h += '<label class="cc-emotions-check"><input type="checkbox" id="cc-emotions-checkbox"> 🎭 ' + esc(T('emotionsGen')) + '</label>';
    h += '<input type="number" id="cc-emotions-variant-input" class="text_pole" min="1" max="10" value="' + (ccData.emotionVariantCount || 1) + '" title="Number of variants per emotion" style="width: 45px; padding: 2px 4px; font-size: 11px; border-radius: 4px;">';
    h += '<span style="font-size: 10px; opacity: 0.6;">var.</span>';
    h += '</div>';

    h += '<div class="cc-footer-spacer"></div>';
    h += '<button class="menu_button" id="cc-f-template"><i class="fa-solid fa-upload"></i> ' + esc(T('template')) + '</button>';
    h += '<button class="menu_button cc-btn-success" id="cc-f-create"><i class="fa-solid fa-check"></i> ' + esc(T('create')) + '</button>';
    h += '</div></div>';

    document.body.insertAdjacentHTML('beforeend', h);
    if (!document.getElementById('cc-file-template'))
        document.body.insertAdjacentHTML('beforeend', '<input type="file" id="cc-file-template" accept=".png,.json" style="display:none"><input type="file" id="cc-file-refimg" accept="image/*" style="display:none">');

    applyPanelPosition();
    bindPanelEvents();
    renderBody();
}

function applyPanelPosition() {
    var $p = $('#cc-panel');
    var wasOpen = $p.hasClass('cc-open');
    if (wasOpen) $p.removeClass('cc-open');
    $p.removeClass('cc-mode-center');
    if (ccSettings.panelPosition === 'center') $p.addClass('cc-mode-center');
    if (wasOpen) {
        $p[0].offsetHeight;
        $p.addClass('cc-open');
    }
}

function bindPanelEvents() {
    $(document).on('click', '#cc-panel-overlay, #cc-h-close', function () { togglePanel(false); });
    $(document).on('keydown', function (e) { if (e.key === 'Escape' && $('#cc-panel').hasClass('cc-open')) togglePanel(false); });
    $(document).on('click', '.cc-mode-btn', function () {
        var mode = $(this).data('mode'); ccData.mode = mode;
        $('.cc-mode-btn').removeClass('active'); $(this).addClass('active');
        $('#cc-tabs').toggle(mode === 'advanced');
        if (mode === 'simple') ccData.activeTab = 'basic';
        renderBody();
    });
    $(document).on('click', '.cc-tab', function () {
        ccData.activeTab = $(this).data('tab');
        $('.cc-tab').removeClass('active'); $(this).addClass('active');
        renderBody();
    });
    $(document).on('click', '#cc-f-generate', doUIGenerate);
    $(document).on('click', '#cc-f-genface', function () { doUIGenImage('face'); });
    $(document).on('click', '#cc-f-genportrait', function () { doUIGenImage('portrait'); });
    $(document).on('click', '#cc-f-genfull', function () { doUIGenImage('fullbody'); });
    $(document).on('click', '#cc-f-create', doUICreateCharacter);
    $(document).on('click', '#cc-f-template', function () { $('#cc-file-template').trigger('click'); });
    $(document).on('click', '#cc-h-reset', function () {
        if (!confirm(T('resetConfirm'))) return; resetData(); renderBody(); showStatus(T('fieldsReset'), 'info');
    });
    $(document).on('click', '#cc-h-tr', doTranslateToggle);

    /* Emotions checkbox sync */
    $(document).on('change', '#cc-emotions-checkbox', function () {
        ccData.generateEmotions = this.checked;
    });

    /* Emotions variant count sync */
    $(document).on('input change', '#cc-emotions-variant-input', function () {
        var val = parseInt($(this).val());
        if (val > 10) val = 10; // Limit to prevent accidents
        if (val < 1) val = 1;
        ccData.emotionVariantCount = val;
    });

    /* Template file */
    $(document).on('change', '#cc-file-template', async function () {
        var file = this.files[0]; if (!file) return;
        try {
            var card = await extractCharFromFile(file);
            ccData.templateText = formatCardAsTemplate(card);
            var d = card.data || card;
            if (d.name) setField('name', d.name);
            if (d.description) setField('description', (d.description || '').replace(/\\r\\n/g, '\n'));
            if (d.personality) setField('personality', d.personality);
            if (d.scenario) setField('scenario', d.scenario);
            if (d.first_mes) setField('firstMessage', (d.first_mes || '').replace(/\\r\\n/g, '\n'));
            if (d.mes_example) setField('mesExample', d.mes_example);
            if (d.alternate_greetings && Array.isArray(d.alternate_greetings)) ccData.altGreetings = d.alternate_greetings;
            renderBody(); showStatus(T('templateLoadedMsg') + (d.name || file.name), 'success');
        } catch (e) { showStatus(e.message, 'error'); }
        this.value = '';
    });

    /* Reference image */
    $(document).on('change', '#cc-file-refimg', function () {
        var file = this.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) { ccData.refImageBase64 = ev.target.result.split(',')[1]; ccData.refImageDesc = ''; renderBody(); };
        reader.readAsDataURL(file); this.value = '';
    });
 $(document).on('change', '#cc-use-ref-input', function () {
        ccData.useRefAsCharAvatar = this.checked;
    });
    /* Gen single field */
    $(document).on('click', '.cc-gen-field-btn', async function () {
        if (ccBusy) return; var key = $(this).data('field'), label = $(this).data('label');
        var opts = $(this).data('options');
        var optArr = opts ? opts.split('|') : null;
        ccBusy = true; $(this).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try { await doGenerateField(key, label, optArr); renderBody(); } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });

/* Enhance field (Improve description) */
    $(document).on('click', '.cc-enhance-field-btn', async function () {
        if (ccBusy) return;
        var key = $(this).data('field');
        var label = $(this).data('label');

        ccBusy = true;
        $(this).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try {
            await doEnhanceField(key, label);
            renderBody();
            showStatus('Field improved!', 'success');
        } catch (e) {
            showStatus(e.message, 'error');
        }
        ccBusy = false;
    });

/* Enhance Alternative Greeting */
    $(document).on('click', '.cc-enhance-alt-btn', async function () {
        if (ccBusy) return;
        var idx = parseInt($(this).data('idx'));

        ccBusy = true;
        $(this).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try {
            await doEnhanceAltGreeting(idx);
            renderBody();
            showStatus('Greeting improved!', 'success');
        } catch (e) {
            showStatus(e.message, 'error');
        }
        ccBusy = false;
    });


    /* Gen all fields */
    $(document).on('click', '#cc-gen-all-fields', async function () {
        if (ccBusy) return; ccBusy = true;
        $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i> ' + T('generating'));
        try { await doGenerateAllFields(); renderBody(); showStatus(T('allFieldsGenerated'), 'success'); } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });

    /* Alt greetings */
    $(document).on('click', '#cc-add-alt-greeting', async function () {
        if (ccBusy) return; ccBusy = true;
        $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try { await doGenerateAltGreeting(); renderBody(); showStatus(T('altGreetingGenerated'), 'success'); } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });
    $(document).on('click', '.cc-alt-remove', function () { ccData.altGreetings.splice(parseInt($(this).data('idx')), 1); renderBody(); });

    /* Describe ref image */
    $(document).on('click', '#cc-describe-ref', async function () {
        if (ccBusy) return; ccBusy = true;
        $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try { await doDescribeRefImage(); renderBody(); showStatus(T('imgDescribed'), 'success'); } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });
    $(document).on('click', '#cc-clear-ref', function () { ccData.refImageBase64 = null; ccData.refImageDesc = ''; renderBody(); });
    $(document).on('click', '.cc-upload-zone', function () { $('#cc-file-refimg').trigger('click'); });

    /* Lock toggle */
    $(document).on('click', '.cc-lock-btn', function () {
        var key = $(this).data('key');
        toggleLock(key);
        $(this).toggleClass('locked');
        $(this).html(isLocked(key) ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>');
    });

    /* Input sync */
    $(document).on('input change', '.cc-data-input', function () { var key = $(this).data('key'); if (key) ccData[key] = $(this).val(); });
    $(document).on('input change', '.cc-outfit-input', function () {
        var idx = parseInt($(this).data('outfit')), slot = $(this).data('slot');
        if (ccData.outfits[idx]) ccData.outfits[idx][slot] = $(this).val();
    });
    $(document).on('input change', '.cc-alt-textarea', function () {
        var idx = parseInt($(this).data('idx'));
        if (idx >= 0 && idx < ccData.altGreetings.length) ccData.altGreetings[idx] = $(this).val();
    });


    /* Outfit management */
    $(document).on('click', '#cc-add-outfit', function () {
        var name = prompt('Outfit name:', 'Outfit ' + (ccData.outfits.length + 1)); if (!name) return;
        ccData.outfits.push({ name: name, head: '', glasses: '', torso: '', arms: '', legs: '', feet: '', underwear: '', accessories: '' });
        renderBody();
    });
    $(document).on('click', '.cc-remove-outfit', function () {
        var idx = parseInt($(this).data('idx'));
        if (ccData.outfits.length <= 1) return;
        ccData.outfits.splice(idx, 1);
        if (ccData.currentOutfitIdx >= ccData.outfits.length) ccData.currentOutfitIdx = 0;
        renderBody();
    });
    $(document).on('click', '.cc-outfit-chip', function () {
        ccData.currentOutfitIdx = parseInt($(this).data('idx'));
        $('.cc-outfit-chip').removeClass('active'); $(this).addClass('active');
    });

    /* Gen outfit */
    $(document).on('click', '.cc-gen-outfit-btn', async function () {
        if (ccBusy) return; var idx = parseInt($(this).data('idx')); ccBusy = true;
        $(this).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try {
            if (!genQuiet) throw new Error(T('noLLM'));
            var prompt = '[OOC: Based on this character, fill in their ' + ccData.outfits[idx].name + ' outfit.\n\nCHARACTER:\n' + gatherContext() + '\n\nJSON: {"head":"","glasses":"","torso":"","arms":"","legs":"","feet":"","underwear":"","accessories":""}\nONLY valid JSON!]';
            var raw = await ccGenQuiet(prompt);
            var data = parseJSON(raw);
            if (data) { var o = ccData.outfits[idx]; for (var s in data) { if (o.hasOwnProperty(s) && data[s]) o[s] = data[s]; } }
            renderBody();
        } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });

    /* Clear template */
    $(document).on('click', '#cc-clear-template', function () { ccData.templateText = ''; renderBody(); });

    /* Swap main image view */
    $(document).on('click', '.cc-main-img-swap', function (e) {
        e.stopPropagation();
        ccData.mainImageView = $(this).data('cc-swap');
        renderBody();
    });

    /* Set avatar source */
    $(document).on('click', '.cc-avatar-btn', function (e) {
        e.stopPropagation();
        ccData.avatarSource = $(this).data('cc-avsrc');
        renderBody();
    });

    /* Lightbox */
    /* Lightbox */
    $(document).on('click', '[data-cc-lightbox]', function (e) {
        // Do not open if a control button inside the container was clicked
        if ($(e.target).closest('.cc-main-img-swap, .cc-avatar-btn, .cc-review-regen, .cc-review-add, .cc-review-delete').length) return;

        var type = $(this).data('cc-lightbox');
        var b64 = null;

        if (type === 'face') b64 = ccData.generatedFaceBase64;
        else if (type === 'portrait') b64 = ccData.generatedPortraitBase64;
        else if (type === 'fullbody') b64 = ccData.generatedFullbodyBase64;
        else if (type === 'ref') b64 = ccData.refImageBase64;
        // Handle emotions from the review modal
        else if (type === 'emotion') {
            var idx = $(this).data('idx');
            if (window._ccReviewData && window._ccReviewData.sprites[idx]) {
                b64 = window._ccReviewData.sprites[idx].b64;
            }
        }

        if (!b64) return;
        $('body').append('<div class="cc-lightbox"><div class="cc-lightbox-close">✕</div><img src="data:image/png;base64,' + b64 + '"></div>');
    });
    $(document).on('click', '.cc-lightbox', function () { $(this).remove(); });

    /* Generate fields for current tab */
    $(document).on('click', '#cc-gen-tab-fields', async function () {
        if (ccBusy) return;
        var tabId = $(this).data('tab');
        if (!tabId) return;
        ccBusy = true;
        $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i> ' + T('generating'));
        try {
            await doGenerateTabFields(tabId);
            renderBody();
            showStatus('Tab fields generated!', 'success');
        } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });

	    /* Section Lock Toggle */
    $(document).on('click', '.cc-section-lock', function() {
        var sectionId = $(this).data('section');
        toggleSectionLock(sectionId);
        $(this).toggleClass('locked');
        $(this).html(isSectionLocked(sectionId) ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>');
    });

    /* Section Generate */
    $(document).on('click', '.cc-section-gen', async function() {
        if (ccBusy) return;
        var sectionId = $(this).data('section');

        if (isSectionLocked(sectionId)) {
            showStatus('Section is locked!', 'error');
            return;
        }

        ccBusy = true;
        $(this).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');

        try {
            await doGenerateSection(sectionId);
            renderBody();
            showStatus('Section generated!', 'success');
        } catch (e) {
            showStatus(e.message, 'error');
        }

        // Restore the icon (renderBody re-renders, this is just a safeguard)
        ccBusy = false;
        // renderBody() updates the DOM, so changing the icon manually is optional; if renderBody is not called:
        // $(this).html('🎲');
    });

	    /* Voice generation events */
    $(document).on('click', '.cc-voice-dur-btn', function() {
        var sec = parseInt($(this).data('sec'), 10);
        ccData.voiceDuration = sec;
        // Update active styles without full re-render
        $('.cc-voice-dur-btn').each(function() {
            var isActive = parseInt($(this).data('sec'), 10) === sec;
            $(this).toggleClass('cc-voice-dur-active', isActive)
                   .css({ 'background': isActive ? 'rgba(var(--accent-color-hsl),0.35)' : '', 'border-color': isActive ? 'rgba(var(--accent-color-hsl),0.8)' : '' });
        });
    });

    $(document).on('click', '#cc-gen-voice-btn', async function() {
        if (ccBusy) return;
        ccBusy = true;
        var $btn = $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
        try { await doGenerateVoice(); }
        catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
        $btn.prop('disabled', false).html('🎙️ ' + esc(T('createVoice')));
    });

    $(document).on('click', '#cc-download-voice-btn', function() {
        if (!ccData.generatedVoiceBase64) return;
        var blob = b64ToBlob(ccData.generatedVoiceBase64, 'audio/wav');
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = (ccData.name || 'character').replace(/[\\/:*?"<>|]/g, '').trim() + '_voice.wav';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    /* Bio slider live update */
    $(document).on('input', '#cc-bio-slider', function () {
        var v = parseInt(this.value) || 10;
        ccData._bioMemoryCount = v;
        $('#cc-bio-count-label').text(v);
    });

    /* Reconstruct Bio button */
    $(document).on('click', '#cc-bio-reconstruct-btn', async function () {
        if (ccBusy) return;
        var count = parseInt($('#cc-bio-slider').val()) || ccData._bioMemoryCount || 10;
        ccData._bioMemoryCount = count;
        ccBusy = true;
        var $btn = $(this).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i> Generating...');
        try {
            var bio = await doReconstructBio(count);
            ccData._generatedBio = bio;
            renderBody();
            showStatus('Biography reconstructed!', 'success');
        } catch (e) { showStatus(e.message, 'error'); }
        ccBusy = false;
    });

    /* Append Bio to Description */
    $(document).on('click', '#cc-bio-append-btn', function () {
        if (!ccData._generatedBio) return;
        var bio = '\n\n[Biography]\n' + ccData._generatedBio;
        ccData.description = (ccData.description || '') + bio;
        ccData._generatedBio = null;
        renderBody();
        showStatus('Biography appended to description!', 'success');
    });

}

function togglePanel(show) {
    var $p = $('#cc-panel');
    var $ov = $('#cc-panel-overlay');
    if (show) {
        $p.removeClass('cc-open cc-mode-center');
        if (ccSettings.panelPosition === 'center') $p.addClass('cc-mode-center');
        $ov.addClass('cc-open');
        $p[0].offsetHeight;
        $p.addClass('cc-open');
        renderBody();
        syncImageButtons();
    } else {
        $p.removeClass('cc-open');
        $ov.removeClass('cc-open');
    }
}

function syncImageButtons() {
    var hasAvatar = !!(ccSettings.generateAvatar);
    $('#cc-f-genface').toggle(!!(hasAvatar && ccSettings.showFace));
    $('#cc-f-genportrait').toggle(!!(hasAvatar && ccSettings.showPortrait));
    $('#cc-f-genfull').toggle(!!(hasAvatar && ccSettings.showFullbody));
    /* Show emotions checkbox only when image generation is enabled */
    $('#cc-emotions-check-wrap').toggle(hasAvatar);
    $('#cc-emotions-checkbox').prop('checked', ccData.generateEmotions);
}

function showStatus(msg, type) {
    var $s = $('#cc-status').text(msg).attr('class', 'cc-status-bar ' + (type || 'info')).show();
    setTimeout(function () { $s.fadeOut(300); }, 4000);
}

function resetData() {
    var keys = Object.keys(ccData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k === 'mode' || k === 'activeTab' || k === '_translated' || k === '_trL') continue;
        if (k === 'outfits') {
            ccData.outfits = [
                { name: 'Everyday', head: '', glasses: '', torso: '', arms: '', legs: '', feet: '', underwear: '', accessories: '' },
                { name: 'Formal', head: '', glasses: '', torso: '', arms: '', legs: '', feet: '', underwear: '', accessories: '' }
            ];
        } else if (k === 'currentOutfitIdx') { ccData.currentOutfitIdx = 0; }
        else if (k === 'altGreetings') { ccData.altGreetings = []; }
        else if (k === 'locked') { ccData.locked = {}; }
        else if (k === 'avatarSource') { ccData.avatarSource = 'portrait'; }
       else if (k === 'mainImageView') { ccData.mainImageView = 'fullbody'; }
        else if (k === 'generateEmotions') { ccData.generateEmotions = false; }
        else if (k === 'useRefAsCharAvatar') { ccData.useRefAsCharAvatar = false; }
        else if (typeof ccData[k] === 'string') { ccData[k] = ''; }
        else { ccData[k] = null; }
    }
}

async function doTranslateToggle() {
    if (ccBusy) return;
    if (!translateFn) { if (typeof toastr !== 'undefined') toastr.warning('Translation not available.'); return; }
    if (ccData._translated) { untranslateUI(); renderFullUI(); return; }
    ccBusy = true;
    var $btn = $('#cc-h-tr').prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
    try { await translateUI(); renderFullUI(); } catch (e) { if (typeof toastr !== 'undefined') toastr.error(e.message); }
    ccBusy = false;
    $btn.prop('disabled', false);
    syncTrBtn();
}

function syncTrBtn() {
    var $b = $('#cc-h-tr');
    if (ccData._translated) $b.addClass('cc-btn-tr-active').html('<i class="fa-solid fa-rotate-left"></i>');
    else $b.removeClass('cc-btn-tr-active').html('<i class="fa-solid fa-language"></i>');
}

function renderFullUI() {
    $('#cc-title-text').text(T('title'));
    $('.cc-mode-btn[data-mode="simple"]').html('✨ ' + esc(T('simple')));
    $('.cc-mode-btn[data-mode="advanced"]').html('⚙️ ' + esc(T('advanced')));
    var tabNames = { basic: T('basic'), appearance: T('appearance'), mind: T('mind'), clothing: T('clothing'), abilities: T('abilities'), card: T('card') };
    $('.cc-tab').each(function () { var t = $(this).data('tab'); if (tabNames[t]) $(this).text(tabNames[t]); });
    $('#cc-f-generate').html('<i class="fa-solid fa-wand-magic-sparkles"></i> ' + esc(T('generate')));
    $('#cc-f-genface').html('<i class="fa-solid fa-circle-user"></i> ' + esc(T('face')));
    $('#cc-f-genportrait').html('<i class="fa-solid fa-image-portrait"></i> ' + esc(T('portrait')));
    $('#cc-f-genfull').html('<i class="fa-solid fa-person"></i> ' + esc(T('fullbody')));
    $('#cc-f-template').html('<i class="fa-solid fa-upload"></i> ' + esc(T('template')));
    $('#cc-f-create').html('<i class="fa-solid fa-check"></i> ' + esc(T('create')));
    syncTrBtn();
    syncImageButtons();
    renderBody();
}

/* ══════════════════════════════════════
   RENDER BODY
   ══════════════════════════════════════ */

function renderBody() {
    var $b = $('#cc-body').empty();
    if (ccData.mode === 'simple') renderSimple($b);
    else {
        switch (ccData.activeTab) {
            case 'basic': renderAdvBasic($b); break;
            case 'appearance': renderAdvAppearance($b); break;
            case 'mind': renderAdvMind($b); break;
            case 'clothing': renderAdvClothing($b); break;
            case 'abilities': renderAdvAbilities($b); break;
            case 'card': renderAdvCard($b); break;
        }
    }
}

function genTabBtn(tabId) {
    return '<button class="menu_button cc-btn-primary" id="cc-gen-tab-fields" data-tab="' + esc(tabId) + '" style="width:100%;font-size:11px!important;padding:5px!important;border-radius:8px!important;margin-bottom:10px"><i class="fa-solid fa-dice"></i> Generate This Tab</button>';
}

function fld(key, label, type, opts) {
    type = type || 'input'; opts = opts || {};
    var val = ccData[key] || '';
    var locked = isLocked(key);
    var h = '<div class="cc-field">';
    h += '<div class="cc-field-label"><span>' + esc(label) + '</span>';
    h += '<span class="cc-lock-btn' + (locked ? ' locked' : '') + '" data-key="' + esc(key) + '" title="Lock field">';
    h += locked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>';
    h += '</span>';

    // Generate button (dice) - hidden when noGen: true
    if (!opts.noGen) {
        var optData = '';
        if (type === 'select' && opts.options) optData = ' data-options="' + esc(opts.options.join('|')) + '"';
        h += '<span class="cc-gen-field-btn" data-field="' + esc(key) + '" data-label="' + esc(label) + '"' + optData + ' title="Generate with LLM">🎲</span>';
    }

    // Enhance button
    if (opts.enhance) {
        h += '<span class="cc-enhance-field-btn" data-field="' + esc(key) + '" data-label="' + esc(label) + '" title="Enhance & Expand description">✨</span>';
    }

    h += '</div>';
    if (type === 'textarea') {
        h += '<textarea class="cc-textarea cc-data-input" data-key="' + esc(key) + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.placeholder || '') + '">' + esc(val) + '</textarea>';
    } else if (type === 'select' && opts.options) {
        h += '<select class="cc-select cc-data-input" data-key="' + esc(key) + '">';
        h += '<option value="">— Select —</option>';
        for (var i = 0; i < opts.options.length; i++) {
            h += '<option value="' + esc(opts.options[i]) + '"' + (val === opts.options[i] ? ' selected' : '') + '>' + esc(opts.options[i]) + '</option>';
        }
        h += '</select>';
    } else {
        h += '<input class="cc-input cc-data-input" type="text" data-key="' + esc(key) + '" value="' + esc(val) + '" placeholder="' + esc(opts.placeholder || '') + '">';
    }
    h += '</div>';
    return h;
}
function sectionTitle(id, title, icon) {
    // Check whether this section has any generate buttons (simple rule: not Card and not Abilities)
    // Basic has an Identity subsection; Abilities is a single block; Card is special.
    // Add buttons for: Identity (Basic), Body, HairEyes, NSFW, Psychology, Cognitive, VoiceHealth.
    var showControls = (id === 'identity' || id === 'body' || id === 'hairEyes' || id === 'nsfw' || id === 'psychology' || id === 'cognitive' || id === 'voiceHealth');

    var h = '<div class="cc-section-title">';
    h += '<span>' + icon + ' ' + esc(title) + '</span>';

    if (showControls) {
        var locked = isSectionLocked(id);
        h += '<div class="cc-section-controls">';
        h += '<span class="cc-section-lock ' + (locked ? 'locked' : '') + '" data-section="' + esc(id) + '" title="Lock entire section">';
        h += locked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>';
        h += '</span>';
        h += '<span class="cc-section-gen" data-section="' + esc(id) + '" title="Generate this section">🎲</span>';
        h += '</div>';
    }

    h += '</div>';
    return h;
}
function renderLeftCol() {
    var showBody = ccSettings.showFullbody;
    var showPortrait = ccSettings.showPortrait;
    if (!showBody && !showPortrait) return '';

    var view = ccData.mainImageView || 'fullbody';
    if (view === 'fullbody' && !showBody) view = 'portrait';
    if (view === 'portrait' && !showPortrait) view = 'fullbody';

    var bigB64 = (view === 'fullbody') ? ccData.generatedFullbodyBase64 : ccData.generatedPortraitBase64;
    var bigLabel = (view === 'fullbody') ? T('fullbody') : T('portrait');
    var bigRatio = (view === 'fullbody') ? '2/3' : '3/4';
    var otherView = (view === 'fullbody') ? 'portrait' : 'fullbody';
    var canSwap = showBody && showPortrait;
    var isAvSrc = (ccData.avatarSource === view);

    var h = '<div class="cc-col-left">';
    h += '<div class="cc-main-img-wrap" style="aspect-ratio:' + bigRatio + '" data-cc-lightbox="' + view + '">';
    if (bigB64) h += '<img src="data:image/png;base64,' + bigB64 + '">';
    else h += '<div class="cc-main-img-placeholder">' + (view === 'fullbody' ? '🧍' : '👤') + '</div>';
    h += '<div class="cc-main-img-label">' + esc(bigLabel) + '</div>';
    if (canSwap) h += '<div class="cc-main-img-swap" data-cc-swap="' + otherView + '" title="Show ' + otherView + '"><i class="fa-solid fa-arrows-rotate"></i></div>';
    h += '<div class="cc-avatar-btn' + (isAvSrc ? ' cc-avatar-active' : '') + '" data-cc-avsrc="' + view + '" title="Use as avatar">★ Avatar</div>';
    h += '</div>';

    if (ccData.refImageBase64) {
        var isAvSrcRef = (ccData.avatarSource === 'ref');
        h += '<div style="font-size:10px;opacity:.4;margin-top:4px">📷 Ref image</div>';

        // Image wrapper with the Avatar button
        h += '<div class="cc-ref-wrap" style="margin-top:2px;">';
        h += '<img src="data:image/png;base64,' + ccData.refImageBase64 + '" style="width:100%;border-radius:6px;display:block;cursor:pointer" data-cc-lightbox="ref">';
        h += '<div class="cc-avatar-btn' + (isAvSrcRef ? ' cc-avatar-active' : '') + '" data-cc-avsrc="ref" title="Use as final character avatar">★ Avatar</div>';
        h += '</div>';

        if (ccData.refImageDesc) h += '<div style="font-size:9px;opacity:.3;margin-top:2px">' + esc(ccData.refImageDesc.substring(0, 80)) + '…</div>';
		 h += '<label style="font-size:10px; opacity:.8; display:flex; align-items:center; gap:4px; margin-top:6px; margin-bottom:4px; cursor:pointer;" title="Send this image to ComfyUI for generation (%input_image%)">';
        h += '<input type="checkbox" id="cc-use-ref-input" ' + (ccData.useRefAsCharAvatar ? 'checked' : '') + ' style="margin:0; cursor:pointer;">';
        h += 'Use for Avatar Generation</label>';

        h += '<div class="cc-left-btns" style="margin-top:4px">';
        var eyeTitle = ccData.refImageDesc ? 'Re-analyze image' : 'Analyze image (Caption API)';
        h += '<button class="menu_button" id="cc-describe-ref" title="' + eyeTitle + '"><i class="fa-solid fa-eye"></i></button>';
        h += '<button class="menu_button cc-btn-danger" id="cc-clear-ref"><i class="fa-solid fa-trash"></i></button></div>';
    } else {
        h += '<div class="cc-upload-zone" style="margin-top:6px"><i class="fa-solid fa-cloud-arrow-up"></i>' + esc(T('uploadRef')) + '</div>';
    }

    h += '</div>';
    return h;
}

function renderFaceRow(nameFieldHtml) {
    if (!ccSettings.showFace) return nameFieldHtml;
    var isAvSrc = (ccData.avatarSource === 'face');
    var h = '<div class="cc-face-row">';
    h += '<div class="cc-face-wrap" data-cc-lightbox="face">';
    if (ccData.generatedFaceBase64) h += '<img src="data:image/png;base64,' + ccData.generatedFaceBase64 + '">';
    else h += '<div class="cc-face-placeholder">😶</div>';
    h += '<div class="cc-avatar-btn' + (isAvSrc ? ' cc-avatar-active' : '') + '" data-cc-avsrc="face" title="Use as avatar" style="top:2px;right:2px;font-size:9px;padding:1px 5px">★</div>';
    h += '</div>';
    h += '<div class="cc-face-fields">' + nameFieldHtml + '</div>';
    h += '</div>';
    return h;
}

function renderSimple($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol();
    h += '<div class="cc-col-right">';
    h += '<div class="cc-section-title">💡 ' + esc(T('simple')) + '</div>';
    h += '<textarea class="cc-textarea cc-simple-idea cc-data-input" data-key="simpleIdea" rows="5" placeholder="Describe your character idea...">' + esc(ccData.simpleIdea) + '</textarea>';
    if (ccData.description || ccData.name) {
        h += '<div class="cc-section-title">📝 ' + esc(T('genCard')) + '</div>';
        h += renderFaceRow(fld('name', T('name'), 'input', { noGen: true }));
        h += fld('description', T('description'), 'textarea', { rows: 6, noGen: true });
        h += fld('personality', T('personalityLabel'), 'textarea', { rows: 2, noGen: true });
        h += fld('scenario', T('scenario'), 'textarea', { rows: 2, noGen: true });
        h += fld('firstMessage', T('firstMessage'), 'textarea', { rows: 4, noGen: true });
        h += fld('mesExample', T('mesExample'), 'textarea', { rows: 3, noGen: true });
        h += renderAltGreetings();
    }
    h += '</div></div>';
    $b.html(h);
}

function renderAdvBasic($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol();
    h += '<div class="cc-col-right">';
    h += '<button class="menu_button cc-btn-primary" id="cc-gen-all-fields" style="width:100%;font-size:12px!important;padding:6px!important;border-radius:8px!important;margin-bottom:10px"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + esc(T('genAllFields')) + '</button>';
    h += genTabBtn('basic');
    h += sectionTitle('identity', T('identity'), '👤');
    h += renderFaceRow(fld('name', T('name')));
    h += '<div class="cc-input-row">' + fld('race', T('race')) + fld('gender', T('gender'), 'select', { options: ['Male', 'Female', 'Non-binary', 'Genderless', 'Other'] }) + '</div>';
    h += '<div class="cc-input-row">' + fld('age', T('age')) + fld('relationship', T('relationship'), 'select', { options: ['Stranger', 'Friend', 'Best Friend', 'Lover', 'Spouse', 'Sibling', 'Parent', 'Child', 'Mentor', 'Student', 'Rival', 'Enemy', 'Servant', 'Master', 'Pet', 'Companion', 'Colleague', 'Other'] }) + '</div>';
    h += '</div></div>';
    $b.html(h);
}

function renderAdvAppearance($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol();
    h += '<div class="cc-col-right">';
    h += genTabBtn('appearance');
    h += sectionTitle('body', T('body'), '📏');
    h += '<div class="cc-input-row">' + fld('height', T('height')) + fld('weight', T('weight')) + '</div>';
    h += fld('musculature', T('musculature'), 'select', { options: ['Skinny', 'Slim', 'Average', 'Athletic', 'Muscular', 'Bodybuilder', 'Chubby', 'Overweight', 'Obese'] });
    h += '<div class="cc-input-row">';
    h += fld('bustSize', T('bustSize'), 'select', { options: ['N/A', 'Flat', 'Small', 'Medium', 'Large', 'Very Large'] });
    h += fld('buttocksSize', T('buttocksSize'), 'select', { options: ['Flat', 'Small', 'Average', 'Round', 'Large', 'Very Large'] });
    h += '</div>';
    h += fld('legLength', T('legLength'), 'select', { options: ['Short', 'Below Average', 'Average', 'Long', 'Very Long'] });
    h += sectionTitle('hairEyes', T('hairEyes'), '💇');
    h += '<div class="cc-input-row">' + fld('hairColor', T('hairColor')) + fld('hairstyle', T('hairstyle')) + '</div>';
    h += fld('eyeColor', T('eyeColor'));
    if (ccSettings.showNSFW) {
        h += sectionTitle('nsfw', T('nsfwParams'), '🔞');
        h += '<div class="cc-input-row">';
        h += fld('penisLengthErect', T('penisLengthErect'), 'input', { placeholder: 'e.g. 18 cm' });
        h += fld('penisLengthFlaccid', T('penisLengthFlaccid'), 'input', { placeholder: 'e.g. 10 cm' });
        h += '</div>';
        h += '<div class="cc-input-row">';
        h += fld('penisGirthErect', T('penisGirthErect'), 'input', { placeholder: 'e.g. 13 cm' });
        h += fld('penisGirthFlaccid', T('penisGirthFlaccid'), 'input', { placeholder: 'e.g. 9 cm' });
        h += '</div>';
        h += '<div class="cc-input-row">';
        h += fld('scrotumSize', T('scrotumSize'), 'select', { options: ['Small', 'Average', 'Large', 'Very Large', 'Enormous'] });
        h += fld('ejaculationVolume', T('ejaculationVolume'), 'input', { placeholder: 'e.g. 5 ml / 0.5 L' });
        h += '</div>';
    }
    h += '</div></div>';
    $b.html(h);
}

function renderAdvMind($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol();
    h += '<div class="cc-col-right">';
    h += genTabBtn('mind');
    h += sectionTitle('psychology', T('psychology'), '🧠');
    h += fld('alignment', T('alignment'), 'select', { options: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'] });
    h += fld('temperament', T('temperament'), 'select', { options: ['Choleric', 'Sanguine', 'Melancholic', 'Phlegmatic', 'Choleric-Sanguine', 'Sanguine-Phlegmatic', 'Melancholic-Choleric', 'Phlegmatic-Melancholic'] });
    h += sectionTitle('cognitive', T('cognitive'), '📊');
    h += '<div class="cc-input-row">' + fld('intelligence', T('intelligence'), 'select', { options: ['Very Low', 'Low', 'Below Average', 'Average', 'Above Average', 'High', 'Very High', 'Genius'] }) + fld('memory', T('memory'), 'select', { options: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Photographic'] }) + '</div>';
    h += '<div class="cc-input-row">' + fld('attention', T('attention'), 'select', { options: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Hyperfocused'] }) + fld('logic', T('logic'), 'select', { options: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Exceptional'] }) + '</div>';
    h += sectionTitle('voiceHealth', T('voiceHealth'), '🗣️');
    h += fld('voiceTimbre', T('voiceTimbre'), 'select', { options: ['High-pitched', 'Soft', 'Average', 'Deep', 'Very Deep', 'Raspy', 'Melodic', 'Whispery', 'Booming', 'Monotone'] });
    h += fld('mentalHealth', T('mentalHealth'));
    h += fld('diseases', T('diseases'));

    // v2.2: Voice Generation Section
    h += '<div class="cc-section-title">🎙️ Voice Generation</div>';
    h += '<div style="margin-bottom:10px">';
    h += '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Sample Duration</label>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    var durations = [10, 20, 30, 60, 90, 120];
    durations.forEach(function(sec) {
        var active = (ccData.voiceDuration || 10) === sec;
        var label = sec >= 60 ? (sec / 60) + ' min' : sec + 's';
        h += '<button class="menu_button cc-voice-dur-btn' + (active ? ' cc-voice-dur-active' : '') + '" data-sec="' + sec + '" style="min-width:48px;flex:1;font-size:12px;padding:4px 6px' + (active ? ';background:rgba(var(--accent-color-hsl),0.35);border-color:rgba(var(--accent-color-hsl),0.8)' : '') + '">' + label + '</button>';
    });
    h += '</div>';
    h += '<button class="menu_button cc-btn-primary" id="cc-gen-voice-btn" style="width:100%;border-radius:8px!important">🎙️ ' + esc(T('createVoice')) + '</button>';
    h += '</div>';

    if (ccData.generatedVoiceBase64) {
        h += '<div class="cc-voice-preview" style="background:rgba(0,0,0,0.15);border-radius:8px;padding:10px;margin-bottom:10px">';
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
        h += '<audio controls style="flex:1;height:32px" src="data:audio/wav;base64,' + ccData.generatedVoiceBase64 + '"></audio>';
        h += '<button class="menu_button" id="cc-download-voice-btn" title="Download Audio"><i class="fa-solid fa-download"></i></button>';
        h += '</div>';
        h += '<div style="font-size:11px;opacity:0.6;text-align:center">Sample voice generated based on character description</div>';
        h += '</div>';
    }

    h += '</div></div>';
    $b.html(h);
}

function renderAdvClothing($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;

    // Start with the layout wrapper, like the other tabs
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol(); // Add the image column
    h += '<div class="cc-col-right">'; // Start the right column

    h += '<div class="cc-section-title">👔 ' + esc(T('outfits')) + '</div>';
    h += '<button class="menu_button" id="cc-add-outfit" style="font-size:11px!important;padding:4px 10px!important;border-radius:6px!important;margin-bottom:10px"><i class="fa-solid fa-plus"></i> ' + esc(T('addOutfit')) + '</button>';

    for (var i = 0; i < ccData.outfits.length; i++) {
        var o = ccData.outfits[i];
        h += '<div class="cc-clothing-set"><div class="cc-clothing-set-header"><div class="cc-clothing-set-name">' + esc(o.name) + '</div><div style="display:flex;gap:4px">';
        h += '<span class="cc-micro-btn cc-gen-outfit-btn" data-idx="' + i + '">🎲</span>';
        h += '<span class="cc-micro-btn cc-remove-outfit" data-idx="' + i + '">✕</span></div></div>';
        var slots = ['head', 'glasses', 'torso', 'arms', 'legs', 'feet', 'underwear', 'accessories'];
        for (var s = 0; s < slots.length; s++) {
            h += '<div class="cc-field" style="margin-bottom:5px"><div class="cc-field-label" style="font-size:11px"><span>' + slots[s] + '</span></div>';
            h += '<input class="cc-input cc-outfit-input" type="text" data-outfit="' + i + '" data-slot="' + slots[s] + '" value="' + esc(o[slots[s]] || '') + '"></div>';
        }
        h += '</div>';
    }

    h += '<div class="cc-section-title">🖼️ ' + esc(T('currentOutfit')) + '</div>';
    h += '<div class="cc-outfit-selector">';
    for (var j = 0; j < ccData.outfits.length; j++) {
        h += '<div class="cc-outfit-chip' + (j === ccData.currentOutfitIdx ? ' active' : '') + '" data-idx="' + j + '">' + esc(ccData.outfits[j].name) + '</div>';
    }
    h += '</div>';

    h += '</div></div>'; // Close cc-col-right and cc-layout
    $b.html(h);
}

function renderAdvAbilities($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol();
    h += '<div class="cc-col-right">';
    h += genTabBtn('abilities');
    h += '<div class="cc-section-title">⚔️ ' + esc(T('combatSkills')) + '</div>';
    h += fld('weapon', T('weapon'));
    h += fld('abilities', T('abilitiesLabel'), 'textarea', { rows: 3 });
    h += fld('languages', T('languages'));
    h += '</div></div>';
    $b.html(h);
}

function renderAdvCard($b) {
    var hasLeft = ccSettings.showFullbody || ccSettings.showPortrait;
    var h = '<div class="cc-layout">';
    if (hasLeft) h += renderLeftCol();
    h += '<div class="cc-col-right">';
    h += '<div class="cc-section-title">📝 ' + esc(T('charCard')) + '</div>';

    // The name usually does not need long-text enhancement; leave as is or add generation
    h += renderFaceRow(fld('name', T('name'), 'input', { noGen: true }));

    // Enable enhance: true here
    h += fld('description', T('description'), 'textarea', { rows: 8, noGen: true, enhance: true });
    h += fld('personality', T('personalityLabel'), 'textarea', { rows: 3, noGen: true, enhance: true });
    h += fld('scenario', T('scenario'), 'textarea', { rows: 3, noGen: true, enhance: true });

    h += '<div class="cc-section-title">💬 ' + esc(T('messages')) + '</div>';

    // And here as well
    h += fld('firstMessage', T('firstMessage'), 'textarea', { rows: 5, noGen: true, enhance: true });
    h += fld('mesExample', T('mesExample'), 'textarea', { rows: 4, noGen: true, enhance: true, placeholder: '<START>\n{{char}}: *example*' });

    h += renderAltGreetings();
    if (ccData.templateText) {
        h += '<div class="cc-section-title">📋 ' + esc(T('templateLoaded')) + '</div>';
        h += '<button class="menu_button cc-btn-danger" id="cc-clear-template" style="font-size:11px!important;padding:4px 10px!important;border-radius:6px!important"><i class="fa-solid fa-trash"></i> ' + esc(T('clearTemplate')) + '</button>';
    }

    /* ═══ RECONSTRUCT BIO ═══ */
    h += '<div class="cc-section-title">📖 Reconstruct Bio</div>';
    h += '<div class="cc-bio-panel">';
    h += '<div class="cc-bio-slider-row">';
    h += '<label class="cc-bio-slider-label">Memory depth: <span id="cc-bio-count-label">' + (ccData._bioMemoryCount || 10) + '</span> events</label>';
    h += '<input type="range" id="cc-bio-slider" class="cc-bio-slider" min="2" max="30" value="' + (ccData._bioMemoryCount || 10) + '">';
    h += '</div>';
    h += '<div style="display:flex;gap:6px;margin-top:8px">';
    h += '<button class="menu_button cc-btn-primary" id="cc-bio-reconstruct-btn" style="flex:1;font-size:11px!important;padding:6px!important;border-radius:8px!important"><i class="fa-solid fa-dna"></i> Reconstruct Biography</button>';
    h += '</div>';
    if (ccData._generatedBio) {
        h += '<div class="cc-bio-preview" id="cc-bio-preview">' + esc(ccData._generatedBio) + '</div>';
        h += '<button class="menu_button cc-btn-success" id="cc-bio-append-btn" style="width:100%;font-size:11px!important;padding:6px!important;border-radius:8px!important;margin-top:6px"><i class="fa-solid fa-file-circle-plus"></i> Append to Description</button>';
    }
    h += '</div>';

    h += '</div></div>';
    $b.html(h);
}

function renderAltGreetings() {
    var h = '<div class="cc-section-title">🔄 ' + esc(T('altGreetings')) + ' (' + ccData.altGreetings.length + ')</div>';
    for (var i = 0; i < ccData.altGreetings.length; i++) {
        h += '<div class="cc-alt-greeting">';
        // Container for the corner control buttons
        h += '<div style="position:absolute; top:2px; right:5px; display:flex; gap:8px; align-items:center; z-index:10;">';
        h += '<span class="cc-enhance-alt-btn" data-idx="' + i + '" title="Enhance & Expand" style="cursor:pointer; font-size:12px; opacity:0.6;">✨</span>';
        h += '<span class="cc-alt-remove" data-idx="' + i + '" style="position:static; cursor:pointer; opacity:0.6;">✕</span>';
        h += '</div>';
        h += '<textarea class="cc-alt-textarea" data-idx="' + i + '" rows="3">' + esc(ccData.altGreetings[i]) + '</textarea></div>';
    }
    h += '<button class="menu_button" id="cc-add-alt-greeting" style="font-size:11px!important;padding:5px 12px!important;border-radius:8px!important"><i class="fa-solid fa-plus"></i> ' + esc(T('genAltGreeting')) + '</button>';
    return h;
}

/* ══════════════════════════════════════
   RECONSTRUCT BIO
   ══════════════════════════════════════ */

async function doReconstructBio(memoryCount) {
    if (!genQuiet) throw new Error(T('noLLM'));

    var name    = ccData.name    || 'the character';
    var age     = parseInt(ccData.age) || 0;
    var race    = ccData.race    || '';
    var gender  = ccData.gender  || '';
    var context = gatherContext();

    if (age <= 0) throw new Error('Please set the character\'s age before reconstructing biography.');

    // Generate random-ish timestamps spread across age with slight jitter
    // Always include birth (age 0)
    var total = Math.max(2, memoryCount);
    var points = [0];

    // Distribute remaining events across the lifespan with randomness
    var interval = age / (total - 1);
    for (var i = 1; i < total - 1; i++) {
        var base = interval * i;
        var jitter = (Math.random() - 0.5) * interval * 0.7;
        var pt = Math.round(Math.max(1, Math.min(age - 1, base + jitter)));
        points.push(pt);
    }
    points.push(age); // last event = current age
    // deduplicate and sort
    points = points.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });

    var prompt = '[OOC: You are a narrative biographer. Generate a detailed biography for a character based on the info below.\n\n' +
        'CHARACTER INFO:\n' + context + '\n\n' +
        'TASK: Write exactly ' + points.length + ' biographical memories/events for ' + name + '.\n' +
        'The events must occur at these ages (in years): ' + points.join(', ') + '\n\n' +
        'Rules:\n' +
        '- Each memory must be 3-4 sentences long (a short paragraph).\n' +
        '- Start each memory with "Age X:" where X is the age.\n' +
        '- Age 0 must be the birth event.\n' +
        '- Events should be plausible, varied and consistent with character personality, race, abilities and backstory.\n' +
        '- Do NOT use equal time intervals — reflect the given ages exactly.\n' +
        '- Write in third person.\n' +
        '- Match the language of the character context.\n\n' +
        'Output ONLY the biography events, one paragraph per event, separated by a blank line. No JSON, no headers, no preamble.]';

    var raw = await ccGenQuiet(prompt);
    return raw.trim();
}

/* ══════════════════════════════════════
   UI ACTIONS
   ══════════════════════════════════════ */

async function doUIGenerate() {
    if (ccBusy) return; ccBusy = true;
    var $btn = $('#cc-f-generate').prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i> ' + esc(T('generating')));
    showStatus(T('generating'), 'info');
    try {
        if (ccData.mode === 'simple') await doSimpleGenerate();
        else await doAdvancedGenerate();
        renderBody(); showStatus(T('charGenSuccess'), 'success');
        if (ccData.mode === 'advanced') {
            ccData.activeTab = 'card'; $('.cc-tab').removeClass('active'); $('.cc-tab[data-tab="card"]').addClass('active'); renderBody();
        }
    } catch (e) { showStatus(e.message, 'error'); E('Generate:', e); }
    ccBusy = false; $btn.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> ' + esc(T('generate')));
}

async function doUIGenImage(imageType) {
    if (ccBusy) return;
    var preset = getAIActivePreset();
    if (!preset || !preset.workflow) { showStatus(T('noPreset'), 'error'); return; }
    if (!genQuiet) { showStatus(T('noLLM'), 'error'); return; }
    if (!ccData.name && !ccData.description && !ccData.simpleIdea) { showStatus(T('enterInfoFirst'), 'error'); return; }
    ccBusy = true;
    var btnMap = { face: '#cc-f-genface', portrait: '#cc-f-genportrait', fullbody: '#cc-f-genfull' };
    var $btn = $(btnMap[imageType]).prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i>');
    showStatus(T('generatingImage'), 'info');
    try { await doGenerateImage(imageType); renderBody(); showStatus(T('imgGenerated'), 'success'); }
    catch (e) { showStatus(e.message, 'error'); E('Image:', e); }
    ccBusy = false;
    var labels = { face: T('face'), portrait: T('portrait'), fullbody: T('fullbody') };
    var icons = { face: 'fa-circle-user', portrait: 'fa-image-portrait', fullbody: 'fa-person' };
    $btn.prop('disabled', false).html('<i class="fa-solid ' + icons[imageType] + '"></i> ' + esc(labels[imageType]));
}

async function doUICreateCharacter() {
    if (ccBusy) return;
    if (!ccData.name || !ccData.name.trim()) { showStatus(T('nameRequired'), 'error'); return; }
    if (!ccData.description) { showStatus(T('descRequired'), 'error'); return; }
    ccBusy = true;
    var $btn = $('#cc-f-create').prop('disabled', true).html('<i class="fa-solid fa-circle-notch fa-spin"></i> ' + esc(T('creatingChar')));
    try {
        var name = await doCreateCharacter();
        showStatus('"' + name + '"' + T('charCreated'), 'success');
        if (typeof toastr !== 'undefined') toastr.success(name + T('charCreated'), T('title'));

        /* ═══ EMOTIONS GENERATION ═══ */
        if (ccData.generateEmotions && ccSettings.generateAvatar) {
            try {
                var emotionCount = await doGenerateEmotions(name);
                showStatus(T('emotionsDone') + ' (' + emotionCount + '/' + EMOTION_LABELS.length + ')', 'success');
                if (typeof toastr !== 'undefined') toastr.success(emotionCount + ' emotion sprites generated!', 'Character Creator');
            } catch (emoErr) {
                if (emoErr.message === T('emotionsCancelled')) {
                    showStatus(T('emotionsCancelled'), 'info');
                    if (typeof toastr !== 'undefined') toastr.warning(T('emotionsCancelled'));
                } else {
                    showStatus('Emotions error: ' + emoErr.message, 'error');
                    E('Emotions:', emoErr);
                    if (typeof toastr !== 'undefined') toastr.error('Emotions: ' + emoErr.message);
                }
            }
        }
    } catch (e) { showStatus(e.message, 'error'); E('Create:', e); }
    ccBusy = false; $btn.prop('disabled', false).html('<i class="fa-solid fa-check"></i> ' + esc(T('create')));
}

/* ══════════════════════════════════════
   CHAT BUTTON & SETTINGS
   ══════════════════════════════════════ */

function buildChatButton() {
    if (document.getElementById('cc-trigger')) return;
    var btn = '<div id="cc-trigger" class="interactable" title="Character Creator"><i class="fa-solid fa-user-plus"></i></div>';
    var $l = $('#leftSendForm'); if ($l.length) $l.append(btn); else { var $f = $('#send_form'); if ($f.length) $f.prepend(btn); }
    $(document).on('click', '#cc-trigger', function () { if (ccSettings.enabled) togglePanel(true); });
    syncBtn();
}

function syncBtn() { $('#cc-trigger').toggle(!!(ccSettings.enabled && ccSettings.showButton)); }

function rebuildPresetDropdown() {
    var $sel = $('#cc-s-preset').empty().append('<option value="">— Use active AI preset —</option>');
    getAIPresetsAll().forEach(function (p) { $sel.append('<option value="' + esc(p.id) + '">' + esc(p.name || 'Untitled') + '</option>'); });
    $sel.val(ccSettings.avatarPresetId || '');
}

/* Populate the AutoIllustrator presets group inside the unified emotions
   dropdown. Built-in options stay static; presets use value 'preset:<id>'. */
function rebuildEmotionModelPresets() {
    var $grp = $('#cc-emo-preset-group'); if (!$grp.length) return;
    $grp.empty();
    var presets = getAIPresetsAll();
    if (!presets.length) {
        $grp.append('<option value="" disabled>(no AutoIllustrator presets found)</option>');
    } else {
        presets.forEach(function (p) {
            $grp.append('<option value="preset:' + esc(p.id) + '">' + esc(p.name || 'Untitled') + '</option>');
        });
    }
    // Restore saved selection (built-in key or preset:ID).
    var sel = ccSettings.emotionsModel || 'flux2klein';
    var $emo = $('#cc-s-emo-model');
    if ($emo.find('option[value="' + sel.replace(/"/g, '\\"') + '"]').length) {
        $emo.val(sel);
    } else {
        // Saved preset no longer exists — fall back to default built-in.
        $emo.val('flux2klein');
    }
}

function buildSettingsPanel() {
    var $c = $('#extensions_settings2'); if (!$c.length) $c = $('#extensions_settings'); if (!$c.length) return;
    var h = '<div id="cc-settings"><div class="inline-drawer">';
    h += '<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-user-plus"></i> Character Creator</b>';
    h += '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>';
    h += '<div class="inline-drawer-content">';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-on"><span>Enable</span></label></div>';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-btn"><span>Show chat button</span></label></div>';
    h += '<hr>';
    h += '<div class="cc-srow"><label>Panel Position</label><select id="cc-s-pos" class="text_pole" style="max-width:200px"><option value="right">Right Drawer</option><option value="center">Center Modal</option></select></div>';
    h += '<hr>';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-genav"><span>Enable image generation (ComfyUI)</span></label></div>';

    h += '<div id="cc-img-options" style="margin-left:24px">';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-showface"><span>Generate Face (1:1)</span></label></div>';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-showportrait"><span>Generate Portrait (3:4)</span></label></div>';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-showfullbody"><span>Generate Full Body (2:3)</span></label></div>';
    h += '<hr>';
    h += '<div class="cc-srow"><label class="checkbox_label"><input type="checkbox" id="cc-s-nsfw"><span>Show NSFW parameters</span></label></div>';
    h += '<small style="opacity:.4;display:block;margin:0 0 6px 24px;font-size:11px"></small>';

    /* ═══ EMOTIONS GENERATION SETTINGS ═══ */
    h += '<hr>';
    h += '<div style="margin-top:6px"><b style="font-size:12px;color:rgba(100,180,255,.7)">🎭 Emotions Generation</b></div>';
    h += '<div class="cc-srow cc-emo-model-row"><label><small>Emotions Model / Workflow</small></label>';
    h += '<div style="display:flex;gap:4px;align-items:center;flex:1">';
    h += '<select id="cc-s-emo-model" class="text_pole" style="flex:1;font-size:.85em">';
    h += '<optgroup label="Built-in workflows">';
    h += '<option value="flux2klein">Flux 2 Klein (9B/4B) — Best</option>';
    h += '<option value="illustrious">Illustrious (SDXL) + IP-Adapter</option>';
    h += '<option value="noobai">NoobAI (SDXL) + IP-Adapter</option>';
    h += '<option value="sdxl">SDXL + IP-Adapter</option>';
    h += '<option value="sd15">SD 1.5 + IP-Adapter</option>';
    h += '</optgroup>';
    h += '<optgroup label="AutoIllustrator presets" id="cc-emo-preset-group"></optgroup>';
    h += '</select>';
    h += '<button class="menu_button" id="cc-emo-preset-refresh" style="font-size:.78em" title="Refresh AutoIllustrator presets"><i class="fa-solid fa-rotate"></i></button>';
    h += '</div></div>';

    h += '<small style="opacity:.45;display:block;margin:4px 0 6px 24px;font-size:10px">' +
         'Built-in: Flux 2 Klein = native image edit (best consistency); ' +
         'Illustrious/NoobAI/SDXL/SD 1.5 = IP-Adapter + ControlNet Canny. All use SwarmRemBg.<br>' +
         'AutoIllustrator preset: uses your own workflow. It must support background removal ' +
         '(e.g. SwarmRemBg) and should use an Edit model (Flux Kontext/Klein, Qwen-Edit) ' +
         'or at least IP-Adapter mode — otherwise sprites will look inconsistent. ' +
         'The character avatar is fed into the preset\'s reference-image slot, the emotion is the prompt.</small>';

    h += '</div>';

    h += '<div class="cc-srow" id="cc-preset-row"><label><small><b>Image AI Preset</b></small></label>';
    h += '<div style="display:flex;gap:4px;align-items:center"><select id="cc-s-preset" class="text_pole" style="flex:1;font-size:.85em"></select>';
    h += '<button class="menu_button" id="cc-preset-refresh" style="font-size:.78em"><i class="fa-solid fa-rotate"></i></button></div></div>';
    h += '<hr><div class="cc-srow"><input type="button" class="menu_button" id="cc-s-open" value="Open Character Creator"></div>';
    h += '<small class="cc-settings-hint">Face (1:1) · Portrait (3:4) · Full Body (2:3) · Fields support locking 🔒 · Emotions 🎭</small>';
    h += '</div></div></div>';
    $c.append(h);

    $('#cc-s-on').prop('checked', ccSettings.enabled).on('change', function () { ccSettings.enabled = this.checked; saveSett(); syncBtn(); });
    $('#cc-s-btn').prop('checked', ccSettings.showButton).on('change', function () { ccSettings.showButton = this.checked; saveSett(); syncBtn(); });
    $('#cc-s-pos').val(ccSettings.panelPosition).on('change', function () { ccSettings.panelPosition = this.value; saveSett(); });
    $('#cc-s-genav').prop('checked', ccSettings.generateAvatar).on('change', function () {
        ccSettings.generateAvatar = this.checked; saveSett();
        $('#cc-img-options, #cc-preset-row').toggle(this.checked);
        syncImageButtons();
    });
    $('#cc-img-options, #cc-preset-row').toggle(!!ccSettings.generateAvatar);

    $('#cc-s-showface').prop('checked', ccSettings.showFace).on('change', function () { ccSettings.showFace = this.checked; saveSett(); syncImageButtons(); });
    $('#cc-s-showportrait').prop('checked', ccSettings.showPortrait).on('change', function () { ccSettings.showPortrait = this.checked; saveSett(); syncImageButtons(); });
    $('#cc-s-showfullbody').prop('checked', ccSettings.showFullbody).on('change', function () { ccSettings.showFullbody = this.checked; saveSett(); syncImageButtons(); });
    $('#cc-s-nsfw').prop('checked', ccSettings.showNSFW).on('change', function () {
        ccSettings.showNSFW = this.checked; saveSett();
        if ($('#cc-panel').hasClass('cc-open')) renderBody();
    });

    /* Emotions model / workflow selector */
    $('#cc-s-emo-model').on('change', function () { ccSettings.emotionsModel = this.value; saveSett(); });
    $('#cc-emo-preset-refresh').on('click', function () { rebuildEmotionModelPresets(); if (typeof toastr !== 'undefined') toastr.info('Found ' + getAIPresetsAll().length + ' preset(s).', 'CC'); });

    $('#cc-s-preset').on('change', function () { ccSettings.avatarPresetId = this.value; saveSett(); });
    $('#cc-preset-refresh').on('click', function () { rebuildPresetDropdown(); if (typeof toastr !== 'undefined') toastr.info('Found ' + getAIPresetsAll().length + ' preset(s).', 'CC'); });
    $('#cc-s-open').on('click', function () { togglePanel(true); });
    setTimeout(function () { rebuildPresetDropdown(); rebuildEmotionModelPresets(); }, 500);
}