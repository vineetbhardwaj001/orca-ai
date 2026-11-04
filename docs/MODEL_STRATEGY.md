# ORCA Model Evaluation & Provider Strategy

## Separation of responsibilities
LLMs interpret discovery, draft scenarios, choose allowed next steps, summarize failures and review evidence. Deterministic engines click/type/navigate, send requests, generate VUs, measure timings, assert outcomes and enforce target allowlists. Policy code independently authorizes risky actions.

## Candidate models
| Model | Task | License/notes | Hardware |
|---|---|---|---|
| Qwen3.5-4B | local discovery summaries, structured scenario drafts | Apache-2.0 on Hugging Face card | first local experiment; quantize and measure RAM |
| Qwen3 + Qwen-Agent | function/tool calling | Qwen3 repository states Apache-2.0 for its open-weight models; pin exact checkpoint | test tool-call success |
| gpt-oss-20b | reasoning and agentic eval | Apache-2.0; Harmony format required | published MXFP4 needs around 16 GB; not ideal for 8 GB laptop |
| Devstral Small 2 24B | coding and repository exploration | Apache-2.0 | official card recommends 32 GB RAM / RTX 4090 class; hosted quota or server |

Sources:
- https://huggingface.co/Qwen/Qwen3.5-4B
- https://github.com/QwenLM/Qwen3
- https://huggingface.co/openai/gpt-oss-20b
- https://huggingface.co/mistralai/Devstral-Small-2-24B-Instruct-2512

## Experiment plan
1. Define ModelProvider methods: generateStructured, generateText, healthCheck.
2. Implement local Ollama-compatible provider and remote OpenAI-compatible provider.
3. Store provider/model/revision/license/quantization metadata.
4. Build 30–50 fixed evaluation tasks using synthetic web products.
5. Score schema validity, discovery accuracy, scenario usefulness, invalid tool calls, hallucinations, reproducibility, latency and cost.
6. Compare against deterministic baseline and retain fallback.
7. Select models per task only after recorded evaluation.

## Practical default
For a development laptop with 8 GB RAM, do not promise 20B/24B local inference. Start with a small quantized model only if it leaves enough RAM for browser, database and IDE. Use hosted free inference only where quota is active and terms allow it. Free tiers change; product correctness must never depend on one.

## Safety
No unrestricted shell/filesystem/network tools for models. Validate tool arguments with Zod. Recheck every proposed URL against project scope and DNS/IP policy. Require approval for destructive and load tests. Model output cannot assign PASS or VERIFIED.
