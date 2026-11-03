/** Lets customer videos pause the background music while they play with sound. */
export const VIDEO_AUDIO_EVENT = "dd:video-audio";

export function announceVideoAudio(active: boolean) {
  window.dispatchEvent(new CustomEvent(VIDEO_AUDIO_EVENT, { detail: { active } }));
}

/** Props to spread on a <video> so it coordinates with the music player. */
export const videoAudioHandlers = {
  onPlay: (e: React.SyntheticEvent<HTMLVideoElement>) => announceVideoAudio(!e.currentTarget.muted),
  onVolumeChange: (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v.paused) announceVideoAudio(!v.muted && v.volume > 0);
  },
  onPause: () => announceVideoAudio(false),
  onEnded: () => announceVideoAudio(false),
};
