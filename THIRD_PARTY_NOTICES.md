# Third-party notices

This independent educational application is not affiliated with Samsung. Original interface, guidance logic, silhouette extraction and project documentation were prepared for this project. The six photorealistic reference WebP files are AI-generated assets; see ASSET_GENERATION.md.

## MediaPipe Tasks Vision
- Author: Google / MediaPipe contributors.
- Version: @mediapipe/tasks-vision 0.10.22-rc.20250304 (pinned).
- Package: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Source: https://github.com/google-ai-edge/mediapipe
- Distribution: https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/
- License: Apache-2.0. See vendor/LICENSE and original copyright headers in distributed files.
- Included unchanged: vision_bundle.mjs, SIMD and non-SIMD WASM loaders and binaries.
- vendor/package-info.json records original package metadata; vendor/README.md is the package's original README.

## Pose Landmarker Lite
- Google MediaPipe pretrained model, float16, version 1.
- Download: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
- Documentation/model information: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- Included unchanged for on-device inference. No training was performed by this project.

All inference assets are included locally. The app makes no external network request for inference, analytics, or image uploads. A local static server serves the files to the browser only.
