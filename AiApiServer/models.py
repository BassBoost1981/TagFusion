import torch

device = torch.device("cuda") if torch.cuda.is_available() else "cpu"

print("Have CUDA: ", torch.cuda.is_available())
print("CUDA Count: ", torch.cuda.device_count())

print("Using interrogator device:", device)

from modules import (
    tagger,
    captioning,
    paths,
    devices,
    editor,
    translator
)

paths.initialize()

BLIP2_CAPTIONING_NAMES = [
    "Salesforce/blip2-opt-2.7b",
    "Salesforce/blip2-opt-2.7b-coco",
    "Salesforce/blip2-opt-6.7b",
    "Salesforce/blip2-opt-6.7b-coco",
    "Salesforce/blip2-flan-t5-xl",
    "Salesforce/blip2-flan-t5-xl-coco",
    "Salesforce/blip2-flan-t5-xxl",
]

FLORENCE2_CAPTIONING_NAMES = [
    "microsoft/Florence-2-base-ft",
    "microsoft/Florence-2-base",
    "microsoft/Florence-2-large-ft",
    "microsoft/Florence-2-large",
    "thwri/CogFlorence-2.2-Large",
]

FLORENCE2PG_CAPTIONING_NAMES = [
    "MiaoshouAI/Florence-2-large-PromptGen-v2.0",
    "MiaoshouAI/Florence-2-base-PromptGen-v2.0",
]

MOONDREAM2_CAPTIONING_NAMES = [
    "vikhyatk/moondream2",
]

JOYCAPTION_CAPTIONING_NAMES = [
    "fancyfeast/llama-joycaption-alpha-two-hf-llava",
    "fancyfeast/llama-joycaption-beta-one-hf-llava",
]

QWEN25_CAPTIONING_NAMES = [
    ("Qwen/Qwen2.5-VL-3B-Instruct", True),
    ("huihui-ai/Qwen2.5-VL-3B-Instruct-abliterated", True),
    ("Qwen/Qwen2.5-VL-7B-Instruct", True),
    ("huihui-ai/Qwen2.5-VL-7B-Instruct-abliterated", True),
    ("prithivMLmods/Qwen2.5-VL-7B-Abliterated-Caption-it", True),
    ("unsloth/Qwen2.5-VL-7B-Instruct-unsloth-bnb-4bit", True),
    ("prithivMLmods/DeepCaption-VLA-7B", True),
    ("internlm/CapRL-3B", False),
]

QWEN3_CAPTIONING_NAMES = [
    ("Qwen/Qwen3-VL-2B-Instruct", True),
    ("Qwen/Qwen3-VL-4B-Instruct", True),
    ("Qwen/Qwen3-VL-4B-Thinking", True),
    ("Qwen/Qwen3-VL-8B-Instruct", True),
    ("Qwen/Qwen3-VL-30B-A3B-Instruct", True),
    ("huihui-ai/Huihui-Qwen3-VL-8B-Instruct-abliterated", True),
    ("prithivMLmods/Qwen3-VL-8B-Abliterated-Caption-it", True),
    ("prithivMLmods/Qwen3-VL-8B-Instruct-abliterated-v2", True),
]

KEYE_CAPTIONING_NAMES = [
    ("Kwai-Keye/Keye-VL-1_5-8B", True),
]

# GGUF vision models served via a bundled llama-server subprocess (llama.cpp engine).
# (display_name, hf_repo, local_subdir, quant_file, mmproj_file, video_supported)
LLAMACPP_CAPTIONING_NAMES = [
    ("Gemma-4-E2B-Uncensored-HauhauCS-Aggressive",
     "HauhauCS/Gemma-4-E2B-Uncensored-HauhauCS-Aggressive",
     "Gemma-4-E2B-Uncensored-HauhauCS-Aggressive",
     "Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf",
     "mmproj-Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-f16.gguf",
     False),
    ("Gemma-4-E4B-Uncensored-HauhauCS-Aggressive",
     "HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive",
     "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive",
     "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf",
     "mmproj-Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-f16.gguf",
     False),
]

LLAMACPP_DEFAULT_PROMPT = (
    "Caption this image as a short, comma-separated list of concise visual tags. "
    "Output only the tags, no explanation."
)

WD_TAGGER_NAMES = [
    "SmilingWolf/wd-v1-4-convnext-tagger",
    "SmilingWolf/wd-v1-4-convnext-tagger-v2",
    "SmilingWolf/wd-v1-4-convnextv2-tagger-v2",
    "SmilingWolf/wd-v1-4-swinv2-tagger-v2",
    "SmilingWolf/wd-v1-4-vit-tagger",
    "SmilingWolf/wd-v1-4-vit-tagger-v2",
    "SmilingWolf/wd-v1-4-moat-tagger-v2",
    "SmilingWolf/wd-vit-tagger-v3",
    "SmilingWolf/wd-swinv2-tagger-v3",
    "SmilingWolf/wd-convnext-tagger-v3",
    "SmilingWolf/wd-vit-large-tagger-v3",
    "SmilingWolf/wd-eva02-large-tagger-v3",
]

FLORENCE2PG_COMMANDS = [
    "<GENERATE_TAGS>",
    "<CAPTION>",
    "<DETAILED_CAPTION>",
    "<MORE_DETAILED_CAPTION>",
    "<ANALYZE>",
    "<MIXED_CAPTION>",
    "<MIXED_CAPTION_PLUS>",
]

FLORENCE2_COMMANDS = [
    "<CAPTION>",
    "<DETAILED_CAPTION>",
    "<MORE_DETAILED_CAPTION>",
    "<CAPTION_TO_PHRASE_GROUNDING>",
    "<OD>",
]

MOONDREAM2_COMMANDS = [
    "Short_caption",
    "Normal_caption",
    "Visual_query",
    "Object_detection",
    "Pointing",
]

BG_REMOVAL = [
    "briaai/RMBG-2.0",
    "ZhengPeng7/BiRefNet",
    "ZhengPeng7/BiRefNet_HR",
    "zhengpeng7/BiRefNet_lite",
    "ZhengPeng7/BiRefNet_lite-2K",
    "ZhengPeng7/BiRefNet-matting",
    "ZhengPeng7/BiRefNet_512x512",
]

SEED_X = [
    "ByteDance-Seed/Seed-X-PPO-7B",
    "ByteDance-Seed/Seed-X-PPO-7B-GPTQ-Int8",
    "ByteDance-Seed/Seed-X-PPO-7B-AWQ-Int4",
]

BG_REMOVAL_RESOLUTION = [
    (1024, 1024),
    (1024, 1024),
    (2048, 2048),
    (1024, 1024),
    (2560, 1440),
    (1024, 1024),
    (512, 512),
]

WD_TAGGER_THRESHOLDS = [
    0.35,
    0.35,
    0.35,
    0.35,
    0.35,
    0.35,
    0.35,
    0.25,
    0.25,
    0.25,
    0.26,
    0.52,
]  # v1: idk if it's okay  v2: P=R thresholds on each repo https://huggingface.co/SmilingWolf

INTERROGATORS = (
        [captioning.BLIP("blip")]
        + [captioning.BLIP2(name, "blip2") for name in BLIP2_CAPTIONING_NAMES]
        + [captioning.GITLarge("gitlarge")]
        + [captioning.Florence2(name, FLORENCE2_COMMANDS, "", False, "florence2") for name in
           FLORENCE2_CAPTIONING_NAMES]
        + [captioning.Florence2(name, FLORENCE2PG_COMMANDS, "", False, "florence2") for name in
           FLORENCE2PG_CAPTIONING_NAMES]
        + [captioning.Moondream2(name, MOONDREAM2_COMMANDS, "", False, "moondream2") for name in
           MOONDREAM2_CAPTIONING_NAMES]
        + [captioning.JoyCaption(name, "", False, "joycaption") for name in JOYCAPTION_CAPTIONING_NAMES]
        + [captioning.Qwen25Caption(name, "", False, video, "qwen25") for name, video in QWEN25_CAPTIONING_NAMES]
        + [captioning.KeyeCaption(name, "", False, video, "keye") for name, video in KEYE_CAPTIONING_NAMES]
        + [captioning.Qwen3Caption(name, "", False, video, "qwen3") for name, video in QWEN3_CAPTIONING_NAMES]
        + [captioning.LlamaCppCaption(name, repo, subdir, quant, mmproj, LLAMACPP_DEFAULT_PROMPT, True, video, "llamacpp")
           for name, repo, subdir, quant, mmproj, video in LLAMACPP_CAPTIONING_NAMES]
        + [tagger.DeepDanbooru(0.5, "dd")]
        + [
            tagger.WaifuDiffusion(name, WD_TAGGER_THRESHOLDS[i], "wd")
            for i, name in enumerate(WD_TAGGER_NAMES)
        ]
)

INTERROGATOR_NAMES = [it.name() for it in INTERROGATORS]

INTERROGATOR_MAP = dict(zip(INTERROGATOR_NAMES, INTERROGATORS))

EDITORS = (
    [
        editor.RMBG2(name, BG_REMOVAL_RESOLUTION[i], "rmbg2")
        for i, name in enumerate(BG_REMOVAL)
    ]
)

EDITOR_NAMES = [it.name() for it in EDITORS]

EDITOR_MAP = dict(zip(EDITOR_NAMES, EDITORS))

TRANSLATORS = (
    [
        translator.seed_x(name, "seedx")
        for i, name in enumerate(SEED_X)
    ]
)

TRANSLATOR_NAMES = [it.name() for it in TRANSLATORS]

TRANSLATOR_MAP = dict(zip(TRANSLATOR_NAMES, TRANSLATORS))


def init():
    devices.init_interrogator()
