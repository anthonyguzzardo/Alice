# Embedding Methods Specification

This document is the methodological artifact for Alice's embedding pipeline.
Paper One's methods section cites this file directly. Its purpose is
long-horizon reproducibility: an external researcher decades from now can
pull the exact weights by SHA-256 and reproduce the exact vectors.

## Current Embedding Model

**Model**: Qwen3-Embedding-0.6B
**Source**: `Qwen/Qwen3-Embedding-0.6B` on Hugging Face
**Architecture**: Qwen3ForCausalLM (causal LM fine-tuned for embeddings)
**Parameters**: 0.6 billion
**Pooling**: Last-token
**Native output dimension**: 1024

## Weights Identification

**SHA-256 (model.safetensors)**:
`0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd`

**Hugging Face commit**: `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`

**Archival location on disk**:
`~/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B/blobs/0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd`

## Inference Environment

| Property | Value |
|---|---|
| Serving layer | Hugging Face Text Embeddings Inference (TEI) |
| TEI version | 1.9.3 |
| Build | Source build with `cargo install --path router -F candle` (CPU-only, no Metal) |
| Binary location | `~/.cargo/bin/text-embeddings-router` |
| Backend | candle (CPU) |
| Precision | float32 (`--dtype float32`) |
| Platform | darwin-arm64 (Apple Silicon) |
| Matryoshka dimension | 512 (client-side truncation + L2 renormalization) |
| Deterministic | Yes (verified: cosine 1.0, max element diff 0 across successive calls) |

**Startup command**:
```
~/.cargo/bin/text-embeddings-router --model-id Qwen/Qwen3-Embedding-0.6B --dtype float32 --port 8090
```

## Matryoshka Truncation

The model outputs 1024-dimensional vectors natively. Alice truncates to 512
dimensions via Matryoshka Representation Learning:

1. Take the first 512 components of the 1024-dim vector
2. L2-renormalize the truncated vector

This preserves the `vector(512)` schema and HNSW index. The 512-dimensional
output is a proper prefix of the model's native output, optimized during
Matryoshka training. No quality loss relative to a 512-native model.

Truncation is performed client-side in `src/lib/libEmbeddings.ts`.

## Database Reference

**Model version table**: `tb_embedding_model_versions`
**Row**: `embedding_model_version_id = 1`
**Active from**: 2026-04-23

## Prior Model (Invalidated)

**Model**: voyage-3-lite (VoyageAI API)
**Status**: All 10 embeddings soft-invalidated via `invalidated_at` timestamp
on 2026-04-23. Rows preserved in `tb_embeddings` for audit trail.
**Reason for replacement**: API-based model fails Alice's constitutional
precondition of archivable weights and deterministic inference. No control
over vendor model version lifecycle or deprecation.

## Licensing

**License**: Apache 2.0

**Known concern**: GitHub issue `QwenLM/Qwen3-Embedding#166` raises a
question about MS MARCO training data licensing (non-commercial use clause)
potentially affecting the Apache 2.0 release of the trained weights. This
is acceptable for Paper One research use. Flagged for Phase Two commercial
deployment review.

## Bit-Reproducibility Verification

Verified 2026-04-23. Two successive calls to TEI with identical input text
produced:

- Cosine similarity: 1.0
- Max element difference: 0
- Vectors bit-identical at both 1024-dim (native) and 512-dim (Matryoshka)

The CPU-only candle backend with FP32 provides IEEE 754 deterministic
inference for the same binary on the same hardware.
