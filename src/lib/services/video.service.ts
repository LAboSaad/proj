import * as faceapi from "face-api.js";

export async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.readyState === 4 && video.videoWidth > 0) {
      resolve();
      return;
    }

    const interval = setInterval(() => {
      if (video.readyState === 4 && video.videoWidth > 0) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

export async function detectFaceWithRetry(
  video: HTMLVideoElement,
  retries = 3
): Promise<faceapi.WithFaceLandmarks<any, any> | null> {
  for (let i = 0; i < retries; i++) {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,      // 🔥 stronger
          scoreThreshold: 0.3, // 🔥 more tolerant
        })
      )
      .withFaceLandmarks();

    if (detection) return detection;

    await new Promise((r) => setTimeout(r, 150));
  }

  return null;
}