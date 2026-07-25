# pylint: disable=bad-indentation
import os
import re
import json
import time
import atexit
import base64
import socket
import subprocess
import urllib.request

from .. import settings
from .. import utilities
from ..server_dataclasses import ObjectDataType


def _strip_reasoning(text: str) -> str:
    """Remove reasoning/thinking blocks emitted by reasoning GGUF models.
    Gemma-4 GGUFs may prepend a '<|channel>thought ... <channel|>ANSWER' block.
    Keep only the final answer and drop any leftover special tokens."""
    for marker in ("<channel|>", "</think>", "</thought>"):
        idx = text.rfind(marker)
        if idx != -1:
            text = text[idx + len(marker):]
            break
    # Drop any residual special tokens like <|channel>, <turn|>, <|think|>.
    text = re.sub(r"<\|?[^>]*?\|?>", "", text)
    return text.strip()


def _llama_server_exe() -> str:
    """Locate the bundled llama-server.exe (override via env)."""
    override = os.environ.get("TAGMANAGER_LLAMA_SERVER")
    if override:
        return override
    return str(utilities.base_dir_path() / "llamacpp" / "llama-server.exe")


def _models_base_dir():
    return utilities.base_dir_path() / "llamacpp_models"


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class LlamaCppCaptioning:
    """Runs a GGUF vision model via a bundled llama-server subprocess and talks
    to it over its OpenAI-compatible HTTP endpoint."""

    def __init__(self, repo, subdir, quant_file, mmproj_file=None):
        self.repo = repo
        self.subdir = subdir
        self.quant_file = quant_file
        self.mmproj_file = mmproj_file
        # main.py inspects `.model` to decide whether a load is needed.
        self.model = None
        self.proc = None
        self.port = None
        self.prompt = ""
        self.split = False
        self.max_tokens = 512
        self.n_gpu_layers = 99
        self.ctx_size = 4096
        self.temperature = 0.3

    # -- file resolution ---------------------------------------------------
    def _ensure_file(self, filename, skip_online: bool):
        dest_dir = _models_base_dir() / self.subdir
        dest = dest_dir / filename
        if dest.is_file():
            return str(dest)
        if skip_online:
            raise RuntimeError(
                f"GGUF file '{filename}' not present locally and internet requests are disabled."
            )
        dest_dir.mkdir(parents=True, exist_ok=True)
        from huggingface_hub import hf_hub_download
        path = hf_hub_download(repo_id=self.repo, filename=filename, local_dir=str(dest_dir))
        return str(path)

    # -- lifecycle ---------------------------------------------------------
    def load(self, prompt, split, max_tokens, n_gpu_layers, skip_online: bool = False):
        self.prompt = prompt
        self.split = split
        self.max_tokens = max_tokens
        self.n_gpu_layers = n_gpu_layers

        # Server already running for this instance -> nothing to do.
        if self.proc is not None and self.proc.poll() is None:
            return

        model_path = self._ensure_file(self.quant_file, skip_online)
        mmproj_path = self._ensure_file(self.mmproj_file, skip_online) if self.mmproj_file else None

        exe = _llama_server_exe()
        if not os.path.isfile(exe):
            raise RuntimeError(
                f"llama-server.exe not found at '{exe}'. Place the llama.cpp binaries in "
                f"AiApiServer/llamacpp/ or set TAGMANAGER_LLAMA_SERVER."
            )

        self.port = _free_port()
        args = [
            exe,
            "-m", model_path,
            "--jinja",
            "-c", str(self.ctx_size),
            "-ngl", str(self.n_gpu_layers),
            "--host", "127.0.0.1",
            "--port", str(self.port),
        ]
        if mmproj_path:
            args += ["--mmproj", mmproj_path]

        creationflags = 0
        if os.name == "nt":
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

        log_path = _models_base_dir() / self.subdir / "llama-server.log"
        self._log_handle = open(log_path, "w", encoding="utf-8", errors="replace")
        self.proc = subprocess.Popen(
            args,
            cwd=os.path.dirname(exe),
            stdout=self._log_handle,
            stderr=subprocess.STDOUT,
            creationflags=creationflags,
        )
        atexit.register(self._kill_process)
        self.model = self.proc

        self._wait_until_ready()

    def _wait_until_ready(self, timeout_s: float = 240.0):
        deadline = time.time() + timeout_s
        url = f"http://127.0.0.1:{self.port}/health"
        while time.time() < deadline:
            if self.proc.poll() is not None:
                self._kill_process()
                raise RuntimeError(
                    f"llama-server exited during startup (code {self.proc.returncode}). "
                    f"See llama-server.log in the model directory."
                )
            try:
                with urllib.request.urlopen(url, timeout=2) as resp:
                    if resp.status == 200:
                        return
            except Exception:
                pass
            time.sleep(1.5)
        self._kill_process()
        raise RuntimeError("llama-server did not become ready in time.")

    def _kill_process(self):
        if self.proc is not None and self.proc.poll() is None:
            try:
                self.proc.terminate()
                try:
                    self.proc.wait(timeout=10)
                except Exception:
                    self.proc.kill()
            except Exception:
                pass
        self.proc = None
        self.model = None
        self.port = None
        handle = getattr(self, "_log_handle", None)
        if handle is not None:
            try:
                handle.close()
            except Exception:
                pass
            self._log_handle = None

    def unload(self):
        if not settings.current.interrogator_keep_in_memory:
            self._kill_process()

    # -- inference ---------------------------------------------------------
    def apply(self, data_obj, data_type: ObjectDataType):
        if self.proc is None or self.proc.poll() is not None or self.port is None:
            return ""
        if data_type != ObjectDataType.IMAGE_BYTE_ARRAY:
            raise Exception("llama.cpp captioner supports only image format.")

        b64 = base64.b64encode(data_obj).decode("ascii")
        data_uri = "data:image/png;base64," + b64

        messages = []
        if settings.current.custom_system_prompt != "":
            messages.append({"role": "system", "content": settings.current.custom_system_prompt})
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": self.prompt},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        })

        payload = {
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "stream": False,
        }
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        message = body["choices"][0]["message"]
        content = message.get("content") or ""
        # Reasoning GGUFs may stream the thinking into a separate field; if the
        # final answer didn't materialise (e.g. token budget spent on thinking),
        # fall back to the reasoning text so we still return something usable.
        if not content.strip():
            content = message.get("reasoning_content") or ""
        content = _strip_reasoning(content)

        if self.split:
            return [x.strip() for x in content.split(",") if x.strip()]
        return [content]
