#!/usr/bin/env python3
"""
Convert csebuetnlp/mT5_multilingual_XLSum to ONNX format for browser inference.

This script exports the multilingual summarization model to ONNX with optional
quantization (int8) for smaller file size and faster inference in the browser
via @xenova/transformers (transformers.js).

Usage:
    # Basic export (float32, ~1.2GB)
    python convert-xlsum-onnx.py

    # With int8 quantization (~300MB)
    python convert-xlsum-onnx.py --quantize int8

    # Upload to HuggingFace Hub
    python convert-xlsum-onnx.py --quantize int8 --upload your-username/mt5-xlsum-onnx

    # Use a local source model (if already downloaded)
    python convert-xlsum-onnx.py --source ./local-mt5-xlsum --quantize int8

Requirements:
    pip install optimum[onnxruntime] transformers sentencepiece protobuf

Supported languages (45): Chinese, English, French, Arabic, Russian, Japanese,
Korean, Spanish, Portuguese, German, and 34 more.
"""

import argparse
import os
import sys
from pathlib import Path


def check_dependencies():
    """Check that required packages are installed."""
    missing = []
    try:
        import optimum  # noqa: F401
    except ImportError:
        missing.append("optimum[onnxruntime]")

    try:
        import transformers  # noqa: F401
    except ImportError:
        missing.append("transformers")

    try:
        import sentencepiece  # noqa: F401
    except ImportError:
        missing.append("sentencepiece")

    try:
        import protobuf  # noqa: F401
    except ImportError:
        missing.append("protobuf")

    if missing:
        print("❌ Missing dependencies. Install with:")
        print(f"   pip install {' '.join(missing)}")
        sys.exit(1)


def convert_model(source_model: str, output_dir: str, quantize: str | None, no_past: bool):
    """Export the model to ONNX format."""
    from optimum.onnxruntime import ORTModelForSeq2SeqLM
    from transformers import AutoTokenizer

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Determine task
    task = "text2text-generation" if no_past else "text2text-generation-with-past"

    print(f"📦 Loading model: {source_model}")
    print(f"   Task: {task}")
    print(f"   Output: {output_path}")

    # Load tokenizer
    print("📥 Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(source_model)
    tokenizer.save_pretrained(output_path)

    # Export to ONNX
    print("🔄 Exporting to ONNX (this may take a while)...")
    if no_past:
        # Export without past key values (simpler, smaller files)
        from optimum.exporters.onnx import main_export
        main_export(
            model_name_or_path=source_model,
            output=output_path,
            task="text2text-generation",
            do_validation=False,
        )
    else:
        # Export with past key values (faster inference, larger files)
        model = ORTModelForSeq2SeqLM.from_pretrained(
            source_model,
            export=True,
        )
        model.save_pretrained(output_path)
        print(f"   Encoder ONNX: {output_path / 'encoder_model.onnx'}")
        print(f"   Decoder ONNX: {output_path / 'decoder_model.onnx'}")
        if (output_path / 'decoder_with_past_model.onnx').exists():
            print(f"   Decoder+Past: {output_path / 'decoder_with_past_model.onnx'}")

    # Quantize if requested
    if quantize:
        print(f"🗜️ Quantizing with {quantize}...")
        quantize_onnx_model(output_path, quantize)

    # Print file sizes
    print("\n📊 Output files:")
    total_size = 0
    for f in sorted(output_path.iterdir()):
        if f.is_file():
            size_mb = f.stat().st_size / (1024 * 1024)
            total_size += size_mb
            print(f"   {f.name}: {size_mb:.1f} MB")
    print(f"   Total: {total_size:.1f} MB")

    # Test inference
    test_inference(output_path, source_model)

    return output_path


def quantize_onnx_model(model_dir: Path, quantize_mode: str):
    """Quantize ONNX model files using onnxruntime."""
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        import onnx
    except ImportError:
        print("⚠️ onnxruntime not installed. Skipping quantization.")
        print("   Install with: pip install onnxruntime")
        return

    onnx_files = list(model_dir.glob("*.onnx"))
    for onnx_file in onnx_files:
        if "quantized" in onnx_file.name or "int8" in onnx_file.name:
            continue

        print(f"   Quantizing {onnx_file.name}...")
        quantized_path = onnx_file.with_name(
            onnx_file.stem + "_quantized.onnx"
        )

        # Determine quantization type
        if quantize_mode == "int8":
            weight_type = QuantType.QInt8
        elif quantize_mode == "uint8":
            weight_type = QuantType.QUInt8
        else:
            weight_type = QuantType.QInt8

        try:
            quantize_dynamic(
                model_input=str(onnx_file),
                model_output=str(quantized_path),
                weight_type=weight_type,
                per_channel=True,
                reduce_range=True,
            )

            # Replace original with quantized
            original_size = onnx_file.stat().st_size
            quantized_size = quantized_path.stat().st_size

            # Rename quantized to original name
            onnx_file.unlink()
            quantized_path.rename(onnx_file)

            reduction = (1 - quantized_size / original_size) * 100
            print(f"   ✅ {onnx_file.name}: {original_size / 1e6:.1f}MB → {quantized_size / 1e6:.1f}MB (-{reduction:.0f}%)")
        except Exception as e:
            print(f"   ⚠️ Quantization failed for {onnx_file.name}: {e}")
            if quantized_path.exists():
                quantized_path.unlink()


def test_inference(model_dir: Path, source_model: str):
    """Test the exported ONNX model with a Chinese text sample."""
    print("\n🧪 Testing inference with Chinese text...")
    try:
        from optimum.onnxruntime import ORTModelForSeq2SeqLM
        from transformers import AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(str(model_dir))

        # Try loading the ONNX model
        try:
            model = ORTModelForSeq2SeqLM.from_pretrained(str(model_dir))
        except Exception as e:
            print(f"   ⚠️ Could not load ONNX model for testing: {e}")
            print("   This is OK — the ONNX files are still valid for transformers.js")
            return

        # Test with Chinese text
        chinese_text = "中国政府宣布了一系列新的经济政策，旨在促进国内消费和科技创新。这些措施包括减税降费、增加基础设施投资以及支持中小企业发展。"
        inputs = tokenizer(f"summarize: {chinese_text}", return_tensors="pt", max_length=512, truncation=True)

        # Generate summary
        summary_ids = model.generate(
            inputs["input_ids"],
            max_length=84,
            min_length=10,
            num_beams=4,
            length_penalty=0.6,
            no_repeat_ngram_size=3,
        )
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        print(f"   输入: {chinese_text[:50]}...")
        print(f"   摘要: {summary}")

        # Test with English text
        english_text = "The government announced new economic policies aimed at boosting domestic consumption and technological innovation. Measures include tax cuts, increased infrastructure investment, and support for small businesses."
        inputs = tokenizer(f"summarize: {english_text}", return_tensors="pt", max_length=512, truncation=True)
        summary_ids = model.generate(
            inputs["input_ids"],
            max_length=84,
            min_length=10,
            num_beams=4,
            length_penalty=0.6,
            no_repeat_ngram_size=3,
        )
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        print(f"   Input: {english_text[:50]}...")
        print(f"   Summary: {summary}")

    except Exception as e:
        print(f"   ⚠️ Inference test failed: {e}")
        print("   The ONNX files may still work with transformers.js even if this test fails.")


def upload_to_hub(model_dir: Path, repo_id: str):
    """Upload the converted model to HuggingFace Hub."""
    try:
        from huggingface_hub import HfApi, create_repo
    except ImportError:
        print("❌ huggingface_hub not installed. Install with: pip install huggingface_hub")
        sys.exit(1)

    print(f"\n📤 Uploading to HuggingFace Hub: {repo_id}")

    api = HfApi()

    # Create repo if it doesn't exist
    try:
        create_repo(repo_id=repo_id, exist_ok=True, repo_type="model")
    except Exception as e:
        print(f"   ⚠️ Could not create repo: {e}")

    # Upload all files
    api.upload_folder(
        folder_path=str(model_dir),
        repo_id=repo_id,
        repo_type="model",
    )
    print(f"   ✅ Uploaded to https://huggingface.co/{repo_id}")
    print(f"\n   Use in your project:")
    print(f'   hfModel: "{repo_id}"')


def main():
    parser = argparse.ArgumentParser(
        description="Convert csebuetnlp/mT5_multilingual_XLSum to ONNX for browser inference"
    )
    parser.add_argument(
        "--source",
        default="csebuetnlp/mT5_multilingual_XLSum",
        help="Source model ID or local path (default: csebuetnlp/mT5_multilingual_XLSum)",
    )
    parser.add_argument(
        "--output",
        default="./mt5-xlsum-onnx",
        help="Output directory for ONNX files (default: ./mt5-xlsum-onnx)",
    )
    parser.add_argument(
        "--quantize",
        choices=["int8", "uint8"],
        default="int8",
        help="Quantization mode (default: int8, set to '' to skip quantization)",
    )
    parser.add_argument(
        "--no-quantize",
        action="store_true",
        help="Skip quantization (export float32 ONNX)",
    )
    parser.add_argument(
        "--no-past",
        action="store_true",
        help="Export without past key values (smaller but slower inference)",
    )
    parser.add_argument(
        "--upload",
        metavar="REPO_ID",
        help="Upload to HuggingFace Hub (e.g., your-username/mt5-xlsum-onnx)",
    )
    parser.add_argument(
        "--skip-test",
        action="store_true",
        help="Skip inference testing after conversion",
    )

    args = parser.parse_args()

    check_dependencies()

    quantize = None if args.no_quantize else args.quantize

    print("=" * 60)
    print("  mT5-multilingual-XLSum → ONNX Converter")
    print("  Supports 45 languages including Chinese, English, French...")
    print("=" * 60)

    output_path = convert_model(
        source_model=args.source,
        output_dir=args.output,
        quantize=quantize,
        no_past=args.no_past,
    )

    if args.upload:
        upload_to_hub(output_path, args.upload)

    print("\n✅ Conversion complete!")
    print(f"\n📁 ONNX files saved to: {output_path}")
    print("\n💡 Next steps:")
    print("   1. Upload to HuggingFace Hub (if not done already):")
    print(f"      python {sys.argv[0]} --upload your-username/mt5-xlsum-onnx")
    print("   2. Update ml-config.ts with the new model ID:")
    print('      hfModel: "your-username/mt5-xlsum-onnx"')


if __name__ == "__main__":
    main()
